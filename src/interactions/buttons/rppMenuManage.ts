import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder } from 'discord.js';
export default {
    id: 'rpp_menu_manage',
    async execute(interaction: ButtonInteraction) {
        if (!interaction.memberPermissions?.has('ManageGuild')) {
            await interaction.reply({ content: 'Sem permissão.', ephemeral: true });
            return;
        }
        const modal = new ModalBuilder()
            .setCustomId('rpp_manage_modal')
            .setTitle('Gerenciar RPP');
        const userIdInput = new TextInputBuilder()
            .setCustomId('user_id')
            .setLabel('ID do usuário')
            .setStyle(1)
            .setMinLength(5)
            .setRequired(true);
        const actionInput = new TextInputBuilder()
            .setCustomId('acao')
            .setLabel('Ação (adicionar|remover)')
            .setStyle(1)
            .setMinLength(3)
            .setRequired(true);
        const reasonInput = new TextInputBuilder()
            .setCustomId('motivo')
            .setLabel('Motivo (obrigatório p/ adicionar)')
            .setStyle(2)
            .setMinLength(3)
            .setRequired(false);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput), new ActionRowBuilder<TextInputBuilder>().addComponents(actionInput), new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput));
        await interaction.showModal(modal);
    }
};
