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
        const retornoIso = target.toISOString().slice(0, 10);
        const cfg: any = loadConfig();
        const mainGuildId = cfg.mainGuildId;
        const userId = interaction.user.id;
        const created = await service.requestRPP(userId, motivo, retornoIso);
        let dispatched = false;
        let dispatchedGuildName: string | undefined;
        const recruitAreaConfig = (cfg.areas || []).find((area: any) => area.name === 'RECRUTAMENTO');
        const recruitGuildId = recruitAreaConfig?.guildId;
        const recruitMemberRoleId = recruitAreaConfig?.roleIds?.member;
        let isRecruitmentStaff = false;
        if (recruitGuildId && recruitMemberRoleId) {
            try {
                const recruitGuild = await interaction.client.guilds.fetch(recruitGuildId).catch(() => null);
                if (recruitGuild) {
                    const recruitMember = await recruitGuild.members.fetch(userId).catch(() => null);
                    if (recruitMember && recruitMember.roles.cache.has(recruitMemberRoleId)) {
                        isRecruitmentStaff = true;
                    }
                }
            }
            catch { }
        }
        if (interaction.guild?.id === mainGuildId) {
            if (isRecruitmentStaff && recruitGuildId) {
                const recruitGuild = await interaction.client.guilds.fetch(recruitGuildId).catch(() => null);
                if (recruitGuild) {
                    await sendRppLog(recruitGuild, 'solicitado', { id: created.id, userId, reason: motivo, returnDate: `${dias} dia(s)`, createdAt: created.requested_at });
                    dispatched = true;
                    dispatchedGuildName = recruitGuild.name;
                }
            }
            else {
                const rppGuildIds: string[] = Object.keys(cfg.rpp?.guilds || {});
                const prog: any = cfg.progressionRoles || {};
                const mainAreaRoleMap: Record<string, string> = cfg.mainAreaRoleMap || {};
                const candidates: {
                    guildId: string;
                    hasUpa: boolean;
                    hasLeadership: boolean;
                    hasMainArea: boolean;
                    memberObj: GuildMember;
                    priority: number;
                }[] = [];
                
                // Verificar cargos principais no servidor principal para determinar área
                const mainGuild = await interaction.client.guilds.fetch(mainGuildId).catch(() => null);
                let userMainArea: string | null = null;
                if (mainGuild) {
                    const mainMember = await mainGuild.members.fetch(userId).catch(() => null);
                    if (mainMember) {
                        // Verificar cargos de área principal
                        for (const [roleId, areaName] of Object.entries(mainAreaRoleMap)) {
                            if (mainMember.roles.cache.has(roleId)) {
                                userMainArea = areaName;
                                break;
                            }
                        }
                    }
                }
                
                for (const gid of rppGuildIds) {
                    if (gid === mainGuildId)
                        continue;
                    const g = await interaction.client.guilds.fetch(gid).catch(() => null);
                    if (!g)
                        continue;
                    const m = await g.members.fetch(userId).catch(() => null) as GuildMember | null;
                    if (!m)
                        continue;
                    
                    const pr = prog[gid];
                    const upaRoles: string[] = pr?.upa || [];
                    const hasUpa = upaRoles.some(r => m.roles.cache.has(r));
                    
                    // Verificar se tem liderança neste servidor
                    const areaConfig = (cfg.areas || []).find((area: any) => area.guildId === gid);
                    const hasLeadership = areaConfig?.roleIds?.lead ? m.roles.cache.has(areaConfig.roleIds.lead) : false;
                    
                    // Verificar se este servidor corresponde à área principal do usuário
                    const hasMainArea = userMainArea ? areaConfig?.name === userMainArea : false;
                    
                    // Calcular prioridade: área principal > liderança > upa > ordem
                    let priority = 0;
                    if (hasMainArea) priority += 1000;
                    if (hasLeadership) priority += 100;
                    if (hasUpa) priority += 10;
                    
                    candidates.push({ 
                        guildId: gid, 
                        hasUpa, 
                        hasLeadership, 
                        hasMainArea, 
                        memberObj: m, 
                        priority 
                    });
                }
                
                if (candidates.length) {
                    // Ordenar por prioridade (maior primeiro)
                    candidates.sort((a, b) => b.priority - a.priority);
                    const preferred = candidates[0];
                    
                    const areaGuild = await interaction.client.guilds.fetch(preferred.guildId).catch(() => null);
                    if (areaGuild) {
                        await sendRppLog(areaGuild, 'solicitado', { id: created.id, userId, reason: motivo, returnDate: `${dias} dia(s)`, createdAt: created.requested_at });
                        dispatched = true;
                        dispatchedGuildName = areaGuild.name;
                    }
                }
            }
        }
        if (!dispatched) {
            await sendRppLog(interaction.guild, 'solicitado', { id: created.id, userId, reason: motivo, returnDate: `${dias} dia(s)`, createdAt: created.requested_at });
        }
        await interaction.editReply(`Solicitação de RPP registrada. Motivo: ${motivo} • Ausência: ${dias} dia(s)` + (dispatched ? ` • Encaminhada a: ${dispatchedGuildName}` : ''));
    }
};
