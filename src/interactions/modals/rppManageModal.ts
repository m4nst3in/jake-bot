import { ModalSubmitInteraction, GuildMember } from 'discord.js';
import { RPPService, applyRppExitRoleRestore } from '../../services/rppService.ts';
import { loadConfig } from '../../config/index.ts';
import { sendRppLog } from '../../utils/rppLogger.ts';
import { formatBrDate } from '../../utils/dateFormat.ts';
import { isOwner } from '../../utils/permissions.ts';
const service = new RPPService();
export default {
    id: 'rpp_manage_modal',
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.fields.getTextInputValue('user_id').trim();
        const acao = interaction.fields.getTextInputValue('acao').trim().toLowerCase();
        const motivo = interaction.fields.getTextInputValue('motivo')?.trim();
        const diasCampo = interaction.fields.getTextInputValue('dias')?.trim();
        let retornoIso: string | undefined;
        let diasAusencia: number | undefined;
        if (diasCampo) {
            const d = parseInt(diasCampo, 10);
            if (!isNaN(d) && d > 0 && d <= 7) {
                diasAusencia = d;
                const target = new Date();
                target.setUTCDate(target.getUTCDate() + d);
                retornoIso = target.toISOString().slice(0, 10);
            }
        }
        const member = interaction.member as GuildMember | null;
        if (!isOwner(member) && !interaction.memberPermissions?.has('ManageGuild')) {
            await interaction.editReply('Sem permissão.');
            return;
        }
        if (!['add', 'remove', 'adicionar', 'remover', 'ativar', 'desativar'].includes(acao)) {
            await interaction.editReply('Ação inválida. Use adicionar|remover.');
            return;
        }
        if (['add', 'adicionar', 'ativar'].includes(acao)) {
            if (!motivo) {
                await interaction.editReply('Motivo obrigatório para adicionar.');
                return;
            }
            const created = await service.requestRPP(userId, motivo, retornoIso);
            await sendRppLog(interaction.guild, 'solicitado', { id: created.id, userId, reason: motivo, returnDate: diasAusencia ? `${diasAusencia} dia(s)` : formatBrDate(retornoIso), createdAt: created.requested_at });
            await interaction.editReply(`Solicitação de RPP criada (pendente) para ${userId}. Motivo: ${motivo} • Ausência: ${diasAusencia ? diasAusencia + ' dia(s)' : formatBrDate(retornoIso)}`);
        }
        else {
            let active: any;
            try {
                active = await (service as any).repo.findActiveByUser(userId);
            }
            catch { }
            await service.removeActive(userId, interaction.user.id);
            const roleIdFixed = ((loadConfig() as any).support?.roles?.rpp);
            if (interaction.guild) {
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (member && roleIdFixed && member.roles.cache.has(roleIdFixed)) {
                    await member.roles.remove(roleIdFixed).catch(() => { });
                }
            }
            let areaName: string | undefined;
            const guildId = interaction.guild?.id;
            if (guildId) {
                const cfgAll: any = loadConfig();
                const areaCfg = (cfgAll.areas || []).find((a: any) => a.guildId === guildId);
                if (areaCfg)
                    areaName = areaCfg.name;
                else if (cfgAll.banca && cfgAll.banca.supportGuildId === guildId)
                    areaName = 'SUPORTE';
            }
            const startedAt = active?.processed_at ? new Date(active.processed_at).toLocaleString('pt-BR') : undefined;
            await sendRppLog(interaction.guild, 'removido', { userId, moderatorId: interaction.user.id, status: 'removido', area: areaName, startedAt });
            await applyRppExitRoleRestore(interaction.client, userId);
            await interaction.editReply(`RPP removido para ${userId}.`);
        }
    }
};
