import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { RPPService } from '../../services/rppService.ts';
import { loadConfig } from '../../config/index.ts';
import { ConfigRepository } from '../../repositories/configRepository.ts';
import { sendRppLog } from '../../utils/rppLogger.ts';
import { assignRppRolesToAllGuilds } from '../../utils/rppRoleAssign.ts';
import { applyRppEntryRoleAdjust } from '../../services/rppService.ts';
import { RPPRepository } from '../../repositories/rppRepository.ts';
export default {
    id: 'rpp_accept',
    async execute(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const idPart = interaction.customId.split(':')[1];
        const rppId = idPart ? (isNaN(Number(idPart)) ? idPart : Number(idPart)) : undefined;
        const service = new RPPService();
        let recordUserId: string | undefined;
        let returnDate: string | undefined;
        let startedAtIso: string | undefined;
        let areaName: string | undefined;
        if (rppId !== undefined) {
            const repo = new RPPRepository();
            const rec = await repo.findById(rppId);
            recordUserId = (rec as any)?.user_id ? String((rec as any).user_id) : undefined;
            const currentStatus = (rec as any)?.status;
            if (!rec) {
                await interaction.editReply({ content: 'Solicitação não encontrada.' });
                return;
            }
            if (currentStatus && currentStatus !== 'PENDING') {
                await interaction.editReply({ content: 'Esta solicitação já foi processada.' });
                try {
                    await interaction.message.delete().catch(() => { });
                }
                catch { }
                return;
            }
            const active = await (service as any).repo.findActiveByUser((rec as any).user_id);
            if (active && String(active.id) !== String(rec.id)) {
                await interaction.editReply({ content: 'Usuário já possui um RPP ativo. Encerre o atual antes de aceitar outro.' });
                return;
            }
            await service.accept(rppId, interaction.user.id);
            startedAtIso = new Date().toISOString();
            const guildId = interaction.guild?.id;
            if (guildId) {
                const cfgAll: any = loadConfig();
                const areaCfg = (cfgAll.areas || []).find((a: any) => a.guildId === guildId);
                if (areaCfg)
                    areaName = areaCfg.name;
                else if (cfgAll.banca && cfgAll.banca.supportGuildId === guildId)
                    areaName = 'SUPORTE';
            }
            returnDate = (rec as any)?.return_date;
            if (recordUserId) {
                await assignRppRolesToAllGuilds(interaction.client, recordUserId);
                await applyRppEntryRoleAdjust(interaction.client, recordUserId);
            }
        }
        await interaction.editReply({ content: 'RPP aceito e registrado.' });
        await sendRppLog(interaction.guild, 'ativado', { userId: recordUserId || String(rppId), moderatorId: interaction.user.id, status: 'ativo', returnDate, createdAt: startedAtIso, area: areaName });
        try {
            await interaction.message.delete().catch(() => { });
        }
        catch { }
    }
};
