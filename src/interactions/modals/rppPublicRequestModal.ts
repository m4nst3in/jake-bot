import { ModalSubmitInteraction, GuildMember } from 'discord.js';
import { RPPService } from '../../services/rppService.ts';
import { sendRppLog } from '../../utils/rppLogger.ts';
import { formatBrDate } from '../../utils/dateFormat.ts';
import { loadConfig } from '../../config/index.ts';
const service = new RPPService();
export default {
    id: 'rpp_public_request_modal',
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const motivo = interaction.fields.getTextInputValue('motivo').trim();
        const diasRaw = interaction.fields.getTextInputValue('retorno').trim();
        const dias = parseInt(diasRaw, 10);
        if (isNaN(dias) || dias < 1 || dias > 7) {
            await interaction.editReply('Informe um número de dias entre 1 e 7.');
            return;
        }
        const target = new Date();
        target.setUTCDate(target.getUTCDate() + dias);
        const retornoIso = target.toISOString().slice(0,10);
        // Nova lógica: se vindo do servidor principal, detectar área do usuário e redirecionar log para o(s) servidor(es) de área elegíveis
        const cfg: any = loadConfig();
        const mainGuildId = cfg.mainGuildId;
        const userId = interaction.user.id;
        const created = await service.requestRPP(userId, motivo, retornoIso);
        let dispatched = false;
        let dispatchedGuildName: string | undefined;
        if (interaction.guild?.id === mainGuildId) {
            // Percorre guilds configuradas para RPP e verifica se o usuário é membro nelas
            const rppGuildIds: string[] = Object.keys(cfg.rpp?.guilds || {});
            const prog: any = cfg.progressionRoles || {};
            const candidates: { guildId: string; hasUpa: boolean; memberObj: GuildMember }[] = [];
            for (const gid of rppGuildIds) {
                if (gid === mainGuildId) continue; // pular principal
                const g = await interaction.client.guilds.fetch(gid).catch(()=>null);
                if (!g) continue;
                const m = await g.members.fetch(userId).catch(()=>null) as GuildMember | null;
                if (!m) continue;
                const pr = prog[gid];
                const upaRoles: string[] = pr?.upa || [];
                const hasUpa = upaRoles.some(r => m.roles.cache.has(r));
                candidates.push({ guildId: gid, hasUpa, memberObj: m });
            }
            if (candidates.length) {
                // Preferir quem tem cargo UPA
                const preferred = candidates.find(c => c.hasUpa) || candidates[0];
                const areaGuild = await interaction.client.guilds.fetch(preferred.guildId).catch(()=>null);
                if (areaGuild) {
                    await sendRppLog(areaGuild, 'solicitado', { id: created.id, userId, reason: motivo, returnDate: `${dias} dia(s)`, createdAt: created.requested_at });
                    dispatched = true;
                    dispatchedGuildName = areaGuild.name;
                }
            }
        }
        if (!dispatched) {
            await sendRppLog(interaction.guild, 'solicitado', { id: created.id, userId, reason: motivo, returnDate: `${dias} dia(s)`, createdAt: created.requested_at });
        }
        await interaction.editReply(`Solicitação de RPP registrada. Motivo: ${motivo} • Ausência: ${dias} dia(s)` + (dispatched ? ` • Encaminhada a: ${dispatchedGuildName}` : ''));
    }
};
