import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder, GuildMember } from 'discord.js';
import { assertAreaPermission } from '../../utils/permissions.ts';
export default {
    id: /^pts_area:(add|remove):(.+)$/,
    async execute(interaction: ButtonInteraction) {
        const [, mode, area] = interaction.customId.split(':');
        const member = interaction.member as GuildMember | null;
        if (!assertAreaPermission(member, area)) {
            await interaction.reply({ content: 'Você não tem permissão pra mexer nos pontos dessa área, intruso!', ephemeral: true });
            return;
        }
        const modal = new ModalBuilder().setCustomId(`pts_amount:${mode}:${area}`).setTitle(`${mode === 'add' ? 'Adicionar' : 'Remover'} • ${area}`);
        const amount = new TextInputBuilder().setCustomId('amount').setLabel('Quantidade de pontos').setStyle(1).setRequired(true);
        const user = new TextInputBuilder().setCustomId('user').setLabel('ID do usuário').setStyle(1).setRequired(true);
        const reason = new TextInputBuilder().setCustomId('reason').setLabel('Motivo').setStyle(2).setRequired(false);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(amount), new ActionRowBuilder<TextInputBuilder>().addComponents(user), new ActionRowBuilder<TextInputBuilder>().addComponents(reason));
        try {
            await interaction.showModal(modal);
        }
        catch (err: any) {
            if (err && err.code === 10062) {
                try {
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({ content: 'A interação expirou. Use /pontos novamente para continuar.', ephemeral: true });
                    }
                }
                catch { }
                return;
            }
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'Não foi possível abrir o modal. Tente novamente.', ephemeral: true });
                }
            }
            catch { }
        }
    }
};
