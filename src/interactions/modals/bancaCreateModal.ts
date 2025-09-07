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
  const journalismCfg:any = (config as any).journalismBanca;
  const journalismGuildId = journalismCfg?.guildId;
  const journalismCategoryId = journalismCfg?.categoryId;
  const journalismPrefix = journalismCfg?.prefix || '💕・';
  let channelName = interaction.guild.id === recruitCfg?.guildId ? `${recruitPrefix}${sanitized}` : `${supportPrefix}${sanitized}`;
  if(interaction.guild.id === journalismGuildId){ channelName = `${journalismPrefix}${sanitized}`; }
  const SUPPORT_CATEGORY_ID = (config as any).support?.categories?.banca;
  const createOptions: any = { name: channelName, permissionOverwrites: [
    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    { id: staffId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
  ] };

  if (interaction.guild.id === recruitCfg?.guildId && recruitCfg?.categoryId) {
    createOptions.parent = recruitCfg.categoryId;
  }
  const SUPPORT_ORDER_REFERENCE = (config as any).banca?.supportOrderReferenceChannelId;
  if (interaction.guild.id === config.banca?.supportGuildId) {
    // Try to use the category of the reference channel dynamically
    const ref = await interaction.guild.channels.fetch(SUPPORT_ORDER_REFERENCE).catch(()=>null) as any;
    if(ref && ref.parentId){
      createOptions.parent = ref.parentId;
    } else {
      createOptions.parent = SUPPORT_CATEGORY_ID; // fallback static
    }
  }
  if (journalismGuildId && interaction.guild.id === journalismGuildId && journalismCategoryId) {
    createOptions.parent = journalismCategoryId;
  }
  let channel: any;
  try {
    channel = await interaction.guild.channels.create(createOptions);
  } catch (err) {

    if (createOptions.parent) {
      delete createOptions.parent;
      channel = await interaction.guild.channels.create(createOptions);
    } else throw err;
  }
  if(!(journalismGuildId && interaction.guild.id === journalismGuildId)){
    await service.create(channel.id, nome, staffId);
  }
  if(interaction.guild.id === config.banca?.supportGuildId){
    try {
      const ref = await interaction.guild.channels.fetch(SUPPORT_ORDER_REFERENCE).catch(()=>null) as any;
      if(ref){
        const targetPos = ref.position;
        if (typeof targetPos === 'number') {
          await channel.edit({ position: targetPos }).catch(()=>{});
        }
      }
    } catch{}
  }
  await interaction.editReply(`Banca criada: <#${channel.id}>`);
  const textChannel = channel as TextChannel;
  const embed = new EmbedBuilder().setTitle(`Banca: ${nome}`).setColor(0x5865F2).setDescription(`Canal criado para a banca **${nome}**`).addFields(
    { name: 'Staff', value: `<@${staffId}>`, inline: true },
    { name: 'Criada por', value: `<@${interaction.user.id}>`, inline: true }
  ).setFooter({ text: `ID: ${channel.id}` }).setTimestamp();
  if(config.banca?.bannerUrl) embed.setImage(config.banca.bannerUrl);
  await textChannel.send({ embeds: [embed] });
}}
