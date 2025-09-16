import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } from 'discord.js';

export default {
    id: 'recruiter_application',
    async execute(interaction: ButtonInteraction) {
        const modal = new ModalBuilder()
            .setCustomId('recruiter_application_modal')
            .setTitle('Candidatura para Recrutador');

        const ageInput = new TextInputBuilder()
            .setCustomId('age')
            .setLabel('Idade')
            .setStyle(TextInputStyle.Short)
            .setMinLength(2)
            .setMaxLength(3)
            .setRequired(true)
            .setPlaceholder('Ex: 18');

        const reasonInput = new TextInputBuilder()
            .setCustomId('reason')
            .setLabel('Motivo de querer entrar para o Recrutamento')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(500)
            .setRequired(true)
            .setPlaceholder('Explique por que deseja fazer parte da equipe de Recrutamento...');

        const timeInput = new TextInputBuilder()
            .setCustomId('available_time')
            .setLabel('Tempo disponível')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(300)
            .setRequired(true)
            .setPlaceholder('Descreva sua disponibilidade de horários...');

        const experienceInput = new TextInputBuilder()
            .setCustomId('experience')
            .setLabel('Experiências que possui')
            .setStyle(TextInputStyle.Paragraph)
            .setMinLength(10)
            .setMaxLength(500)
            .setRequired(true)
            .setPlaceholder('Descreva suas experiências relevantes...');

        const firstRow = new ActionRowBuilder<TextInputBuilder>().addComponents(ageInput);
        const secondRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
        const thirdRow = new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput);
        const fourthRow = new ActionRowBuilder<TextInputBuilder>().addComponents(experienceInput);

        modal.addComponents(firstRow, secondRow, thirdRow, fourthRow);

        await interaction.showModal(modal);
    }
};
