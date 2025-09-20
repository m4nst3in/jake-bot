import { ModalSubmitInteraction } from 'discord.js';
import { PointsService } from '../../../src/services/pointsService.ts';
import { AREAS, isValidArea, normalizeAreaName } from '../../constants/areas.ts';
import { loadConfig } from '../../config/index.ts';
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
            const cfg: any = loadConfig();
            const owners: string[] = cfg.owners || [];
            const fullAccessRoleId: string | undefined = cfg.fullAccessRoleId;
            const hasFull = !!(fullAccessRoleId && (interaction.member as any)?.roles?.cache?.has(fullAccessRoleId));
            const isOwner = owners.includes(interaction.user.id);
            if (areaRaw && areaRaw !== '__all__') {
                const canonical = normalizeAreaName(areaRaw || '');
                if (!canonical || !isValidArea(canonical))
                    return interaction.editReply('Área inválida.');
                // permission: must be owner/full OR leader of this area
                let isAreaLeader = false;
                const key = canonical.toLowerCase();
                const leaderRoleId: string | undefined = cfg.primaryGuildLeadershipRoles?.[key];
                if (leaderRoleId) {
                    isAreaLeader = !!(interaction.member as any)?.roles?.cache?.has(leaderRoleId);
                }
                if (!(isOwner || hasFull || isAreaLeader)) {
                    return interaction.editReply('Sem permissão: apenas owners/full podem resetar tudo. Líder de área só pode resetar a sua área.');
                }
                const dbArea = canonical;
                await (svc as any).resetArea(dbArea);
                await interaction.editReply(`Pontuações da área ${canonical} resetadas.`);
            }
            else {
                // '__all__' requires owner/full access
                if (!(isOwner || hasFull)) {
                    return interaction.editReply('Sem permissão para resetar todas as pontuações.');
                }
                await (svc as any).resetAll();
                await interaction.editReply('Todas as pontuações foram resetadas.');
            }
        }
        catch (err: any) {
            await interaction.editReply('Erro ao resetar: ' + (err?.message || 'desconhecido'));
        }
    }
};
