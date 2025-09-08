import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder } from 'discord.js';

// Botão para criar banca de Design
export default {
  id: 'design_banca_create',
  async execute(interaction: ButtonInteraction){
    const modal = new ModalBuilder()
      .setCustomId('design_banca_create_modal')
      .setTitle('Criar Banca de Design');

    const nome = new TextInputBuilder().setCustomId('nome').setLabel('Nome da banca').setStyle(1).setMinLength(2).setRequired(true);
    const dono = new TextInputBuilder().setCustomId('dono').setLabel('ID do dono').setStyle(1).setMinLength(5).setRequired(true);
    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(nome),
      new ActionRowBuilder<TextInputBuilder>().addComponents(dono)
    );
    await interaction.showModal(modal);
  }
};
