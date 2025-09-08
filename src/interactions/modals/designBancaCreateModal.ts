import { ModalSubmitInteraction, PermissionsBitField, TextChannel, EmbedBuilder } from 'discord.js';
import { BancaService } from '../../services/bancaService.ts';
const service = new BancaService();

// Config fixos solicitados
const DESIGN_CATEGORY_ID = '1183909150980325389';
const EMBED_EMOJIS = [
  '<:cdwds_gcheck:1190435124161032303>',
  '<:cdwdsg_aula:1190435180880601098>',
  '<:cdwdsg_aviso:1190435195736838327>',
  '<:cdwdsg_membros:1190435451199303762>'
];

export default {
  id: 'design_banca_create_modal',
  async execute(interaction: ModalSubmitInteraction){
    await interaction.deferReply({ ephemeral: true });
    if(!interaction.guild){ await interaction.editReply('Guild indisponível.'); return; }

    const nome = interaction.fields.getTextInputValue('nome').trim();
    const donoId = interaction.fields.getTextInputValue('dono').trim();
    const base = nome.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/gi,'');
    const channelName = `꒰🎨・${base.slice(0,40)}`;

    const createOptions: any = {
      name: channelName,
      parent: DESIGN_CATEGORY_ID,
      permissionOverwrites: [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        { id: donoId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
      ]
    };

    let channel: any;
    try {
      channel = await interaction.guild.channels.create(createOptions);
    } catch (err) {
      await interaction.editReply('Falha ao criar canal.');
      return;
    }

    // Registrar banca (reaproveita tabela existente)
    try { await service.create(channel.id, nome, donoId); } catch {}

    const ownerMention = `<@${donoId}>`;
    const greetingLines = [
      `${EMBED_EMOJIS[0]} Seja bem vindo/a a equipe de Design! Esse é o seu portfólio. Envie suas artes no chat do pedido marcando a pessoa que o abriu, e logo depois, envie aqui no seu portfólio sem nenhuma marcação.`,
      `${EMBED_EMOJIS[1]} Não se esqueça de fazer no MÍNIMO 3 artes por semana para não ser rebaixado/rebocado da equipe.`,
      `${EMBED_EMOJIS[2]} Se houver alguma dúvida, favor chamar a liderança no privado.`,
    ].join('\n\n');

    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setDescription(`Olá ${ownerMention} !\n\n${greetingLines}`)
      .setFooter({ text: 'Liderança de Design - CDW Jake' });

    try {
      await (channel as TextChannel).send({ embeds: [embed] });
    } catch {}

    await interaction.editReply(`Banca de design criada: <#${channel.id}>`);
  }
};
