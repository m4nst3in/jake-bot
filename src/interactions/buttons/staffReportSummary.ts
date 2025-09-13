import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { StaffReportService } from '../../services/staffReportService.ts';
import { logger } from '../../utils/logger.ts';
export default {
    id: /^staff_report_summary_/,
    async execute(interaction: ButtonInteraction) {
        await interaction.deferUpdate();
        try {
            const userId = interaction.customId.replace('staff_report_summary_', '');
            const service = new StaffReportService();
            const user = await interaction.client.users.fetch(userId).catch(() => null);
            if (!user) {
                await interaction.editReply({
                    content: '❌ Usuário não encontrado.',
                    embeds: [],
                    components: []
                });
                return;
            }
            const embed = await service.generateSummaryEmbed(userId, user);
            const buttons = service.generateNavigationButtons(userId, 'summary');
            await interaction.editReply({
                embeds: [embed],
                components: [buttons]
            });
        }
        catch (error) {
            logger.error({ error, customId: interaction.customId }, 'Erro no botão staff_report_summary');
            await interaction.editReply({
                content: '❌ Erro interno ao carregar resumo do staff.',
                embeds: [],
                components: []
            });
        }
    }
};
