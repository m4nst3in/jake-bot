import { ModalSubmitInteraction } from 'discord.js';
import { PointsService } from '../../../src/services/pointsService.ts';
import { AREAS, isValidArea } from '../../constants/areas.ts';
const svc = new PointsService();

export default {
  id: 'reset_points_modal',
  async execute(interaction: ModalSubmitInteraction){
    const custom = interaction.customId; // reset_points_modal:AREA
    const parts = custom.split(':');
    const areaRaw = parts[1];
    const typed = interaction.fields.getTextInputValue('confirm').trim().toLowerCase();
    if (typed !== 'confirmar') {
      return interaction.reply({ content: 'Confirmação incorreta. Digite exatamente confirmar.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      if (areaRaw && areaRaw !== '__all__') {
        if (!isValidArea(areaRaw)) return interaction.editReply('Área inválida.');
        await (svc as any).resetArea(areaRaw);
        await interaction.editReply(`Pontuações da área ${areaRaw} resetadas.`);
      } else {
        await (svc as any).resetAll();
        await interaction.editReply('Todas as pontuações foram resetadas.');
      }
    } catch (err:any) {
      await interaction.editReply('Erro ao resetar: ' + (err?.message || 'desconhecido'));
    }
  }
};
