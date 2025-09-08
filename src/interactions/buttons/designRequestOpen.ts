import { ButtonInteraction, ActionRowBuilder, ButtonBuilder } from 'discord.js';

export default {
  id: 'design_request_open',
  async execute(interaction: ButtonInteraction){
    // Exibe seleção de áreas via botões (7 áreas -> 2 linhas)
    const areas = [
      { key: 'design', label: 'Design' },
      { key: 'eventos', label: 'Eventos' },
      { key: 'jornalismo', label: 'Jornalismo' },
      { key: 'movcall', label: 'Mov Call' },
      { key: 'suporte', label: 'Suporte' },
      { key: 'recrutamento', label: 'Recrutamento' },
      { key: 'outros', label: 'Outros' }
    ];
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...areas.slice(0,5).map(a=> new ButtonBuilder().setCustomId(`design_request_pick:${a.key}`).setLabel(a.label).setStyle(1))
    );
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      ...areas.slice(5).map(a=> new ButtonBuilder().setCustomId(`design_request_pick:${a.key}`).setLabel(a.label).setStyle(2))
    );
    await interaction.reply({ content: 'Selecione a área do pedido:', components:[row1,row2], ephemeral: true });
  }
};
