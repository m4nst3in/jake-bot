import { ModalSubmitInteraction, PermissionsBitField, TextChannel, EmbedBuilder } from 'discord.js';
import { loadConfig } from '../../config/index.ts';
import { BancaService } from '../../services/bancaService.ts';
const service = new BancaService();
export default { id: 'banca_create_modal', async execute(interaction: ModalSubmitInteraction){
  await interaction.deferReply({ ephemeral: true });
  if(!interaction.guild){ await interaction.editReply('Guild indisponível'); return; }
  const nome = interaction.fields.getTextInputValue('nome').trim();
  const staffId = interaction.fields.getTextInputValue('staff').trim();
  const sanitized = nome.toLowerCase().replace(/\s+/g,'-');
  const config = loadConfig();
  const recruitCfg: any = (config as any).recruitBanca;
  const recruitPrefix = recruitCfg?.prefix || '🟢・';
  const supportPrefix = '📖・';
  const channelName = interaction.guild.id === recruitCfg?.guildId ? `${recruitPrefix}${sanitized}` : `${supportPrefix}${sanitized}`;
  const SUPPORT_CATEGORY_ID = '1190515972239528001';
  const createOptions: any = { name: channelName, permissionOverwrites: [
    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: staffId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
  ] };
  // Para recrutamento usamos categoria configurada (se existir)
  if (interaction.guild.id === recruitCfg?.guildId && recruitCfg?.categoryId) {
    createOptions.parent = recruitCfg.categoryId;
  }
  if (interaction.guild.id === config.banca?.supportGuildId) {
    createOptions.parent = SUPPORT_CATEGORY_ID;
  }
  let channel: any;
  try {
    channel = await interaction.guild.channels.create(createOptions);
  } catch (err) {
    // fallback sem parent se der erro de categoria
    if (createOptions.parent) {
      delete createOptions.parent;
      channel = await interaction.guild.channels.create(createOptions);
    } else throw err;
  }
  await service.create(channel.id, nome, staffId);
  await interaction.editReply(`Banca criada: <#${channel.id}>`);
  const textChannel = channel as TextChannel;
  const embed = new EmbedBuilder().setTitle(`Banca: ${nome}`).setColor(0x5865F2).setDescription(`Canal criado para a banca **${nome}**`).addFields(
    { name: 'Staff', value: `<@${staffId}>`, inline: true },
    { name: 'Criada por', value: `<@${interaction.user.id}>`, inline: true }
  ).setFooter({ text: `ID: ${channel.id}` }).setTimestamp();
  if(config.banca?.bannerUrl) embed.setImage(config.banca.bannerUrl);
  await textChannel.send({ embeds: [embed] });
}}