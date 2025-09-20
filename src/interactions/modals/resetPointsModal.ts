import { ModalSubmitInteraction } from 'discord.js';
import { PointsService } from '../../../src/services/pointsService.ts';
import { AREAS, isValidArea, normalizeAreaName } from '../../constants/areas.ts';
const svc = new PointsService();
export default {
    id: 'reset_points_modal',
    async execute(interaction: ModalSubmitInteraction) {
        const custom = interaction.customId;
        const parts = custom.split(':');
        const areaRaw = parts[1];
        const typed = interaction.fields.getTextInputValue('confirm').trim().toLowerCase();
        if (typed !== 'confirmar') {
            return interaction.reply({ content: 'Confirmação incorreta. Digite exatamente confirmar.', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            if (areaRaw && areaRaw !== '__all__') {
                const canonical = normalizeAreaName(areaRaw || '');
                if (!canonical || !isValidArea(canonical))
                    return interaction.editReply('Área inválida.');
                // Map display name to DB key where needed (Movcall is the DB key/display)
                const dbArea = canonical === 'Movcall' ? 'Movcall' : canonical;
                await (svc as any).resetArea(dbArea);
                await interaction.editReply(`Pontuações da área ${canonical} resetadas.`);
            }
            else {
                await (svc as any).resetAll();
                await interaction.editReply('Todas as pontuações foram resetadas.');
            }
        }
        catch (err: any) {
            await interaction.editReply('Erro ao resetar: ' + (err?.message || 'desconhecido'));
        }
    }
};
