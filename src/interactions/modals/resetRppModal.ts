import { ModalSubmitInteraction } from 'discord.js';
import { RPPService } from '../../services/rppService.ts';
import { sendRppLog } from '../../utils/rppLogger.ts';
const rppSvc = new RPPService();

export default {
  id: 'reset_rpp_modal',
  async execute(interaction: ModalSubmitInteraction){
    const custom = interaction.customId;
    const parts = custom.split(':');
    const scope = parts[1];
    const typed = interaction.fields.getTextInputValue('confirm').trim().toLowerCase();
    if (typed !== 'confirmar') {
      return interaction.reply({ content: 'Confirmação incorreta. Digite EXATAMENTE "confirmar".', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    try {

      if (scope && scope !== '__all__') {

        return interaction.editReply('Reset parcial por área de RPP ainda não é suportado, blz? Use a opção geral.');
      }
      await rppSvc.resetAll();
      await interaction.editReply('Todos os registros de RPP foram limpos.');
    } catch (err:any) {
      await interaction.editReply('Erro ao resetar RPP: ' + (err?.message || 'desconhecido'));
    }
  }
};
