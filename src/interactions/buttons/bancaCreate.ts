import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder } from 'discord.js';
export default { id: 'banca_create', async execute(interaction: ButtonInteraction) {
        const modal = new ModalBuilder().setCustomId('banca_create_modal').setTitle('Criar Banca');
        const nome = new TextInputBuilder().setCustomId('nome').setLabel('Nome da banca').setStyle(1).setMinLength(2).setRequired(true);
        const staff = new TextInputBuilder().setCustomId('staff').setLabel('ID do staff').setStyle(1).setMinLength(5).setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(nome), new ActionRowBuilder<TextInputBuilder>().addComponents(staff));
        await interaction.showModal(modal);
    } };
