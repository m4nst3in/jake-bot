import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { StaffReportService } from '../../services/staffReportService.ts';
import { logger } from '../../utils/logger.ts';

export default {
  id: /^staff_report_history_/,
  async execute(interaction: ButtonInteraction) {
    
    await interaction.deferUpdate();
    
    try {
      const userId = interaction.customId.replace('staff_report_history_', '');
      const service = new StaffReportService();
      
      // Buscar o usuário
      const user = await interaction.client.users.fetch(userId).catch(() => null);
      if (!user) {
        await interaction.editReply({ 
          content: '❌ Usuário não encontrado.',
          embeds: [],
          components: [] 
        });
        return;
      }
      
      // Gerar embed de histórico
      const embed = await service.generateHistoryEmbed(userId, user);
      const buttons = service.generateNavigationButtons(userId, 'history');
      
      await interaction.editReply({
        embeds: [embed],
        components: [buttons]
      });
      
    } catch (error) {
      logger.error({ error, customId: interaction.customId }, 'Erro no botão staff_report_history');
      await interaction.editReply({
        content: '❌ Erro interno ao carregar histórico do staff.',
        embeds: [],
        components: []
      });
    }
  }
};
