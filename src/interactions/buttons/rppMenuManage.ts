import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder, GuildMember } from 'discord.js';
import { isOwner } from '../../utils/permissions.ts';
export default {
    id: 'rpp_menu_manage',
    async execute(interaction: ButtonInteraction) {
        const member = interaction.member as GuildMember | null;
        if (!isOwner(member) && !interaction.memberPermissions?.has('ManageGuild')) {
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
        const daysInput = new TextInputBuilder()
            .setCustomId('dias')
            .setLabel('Dias (1-7) (não colocar se for remover)')
            .setStyle(1)
            .setRequired(false);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(userIdInput), new ActionRowBuilder<TextInputBuilder>().addComponents(actionInput), new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput), new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput));
        await interaction.showModal(modal);
    }
};
