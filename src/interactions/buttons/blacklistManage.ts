import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder } from 'discord.js';
export default {
    id: 'bl_manage',
    async execute(interaction: ButtonInteraction) {
        if (!interaction.memberPermissions?.has('ManageGuild')) {
            await interaction.reply({ content: 'Sem permissão.', ephemeral: true });
            return;
        }
        const targetId = interaction.customId.split(':')[1];
        const modal = new ModalBuilder().setCustomId(`bl_manage_modal:${targetId}`).setTitle('Gerenciar Blacklist');
        const acao = new TextInputBuilder().setCustomId('acao').setLabel('Ação (adicionar|remover)').setStyle(1).setMinLength(3).setRequired(true);
        const area = new TextInputBuilder().setCustomId('area').setLabel('Área (ex: Mov Call, Design ou Geral)').setStyle(1).setMinLength(3).setRequired(true);
        const motivo = new TextInputBuilder().setCustomId('motivo').setLabel('Motivo (obrigatório se adicionar)').setStyle(2).setRequired(false).setMinLength(3);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(acao), new ActionRowBuilder<TextInputBuilder>().addComponents(area), new ActionRowBuilder<TextInputBuilder>().addComponents(motivo));
        await interaction.showModal(modal);
    }
};
