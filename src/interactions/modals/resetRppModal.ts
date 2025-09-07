import { ModalSubmitInteraction } from 'discord.js';
import { RPPService } from '../../services/rppService.ts';
import { sendRppLog } from '../../utils/rppLogger.ts';
const rppSvc = new RPPService();

export default {
  id: 'reset_rpp_modal',
  async execute(interaction: ModalSubmitInteraction){
    const custom = interaction.customId; // reset_rpp_modal:AREA_OR__all__
    const parts = custom.split(':');
    const scope = parts[1]; // area ou __all__
    const typed = interaction.fields.getTextInputValue('confirm').trim().toLowerCase();
    if (typed !== 'confirmar') {
      return interaction.reply({ content: 'Confirmação incorreta. Digite exatamente confirmar.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      // Para RPP vamos somente limpar todos (ou futuramente por área se armazenarmos área). Hoje não temos área salva em cada registro.
      if (scope && scope !== '__all__') {
        // Sem suporte atual a reset parcial de RPP (depende de campo area no repo). Por enquanto bloqueia.
        return interaction.editReply('Reset parcial por área de RPP ainda não suportado. Use opção geral.');
      }
      await rppSvc.resetAll();
      await interaction.editReply('Todos os registros de RPP foram limpos.');
    } catch (err:any) {
      await interaction.editReply('Erro ao resetar RPP: ' + (err?.message || 'desconhecido'));
    }
  }
};
