import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder } from 'discord.js';

export default {
  id: 'design_ticket_delete',
  async execute(interaction: ButtonInteraction){
    const modal = new ModalBuilder().setCustomId('design_ticket_delete_modal').setTitle('Confirmar Exclusão');
    const reason = new TextInputBuilder().setCustomId('delete_reason').setLabel('Confirme digitando APAGAR').setStyle(1).setRequired(true).setMaxLength(20);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(reason));
    await interaction.showModal(modal);
  }
};
