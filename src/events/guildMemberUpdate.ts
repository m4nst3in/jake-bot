import { GuildMember, Events, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { loadConfig } from '../config/index.ts';
interface BlockedRoleInfo {
    name: string;
    allowedLeaderRole?: string;
    allowedLeaderRoles?: string[];
}
function getProtectionConfig() {
    const cfg: any = loadConfig();
    const p = cfg.protection || {};
    return {
        botRoles: p.botRoles || [],
        alertRole: p.alertRole as string | undefined,
        alertUsers: (p.alertUsers || []) as string[],
        blockedRoles: (p.blockedRoles || {}) as Record<string, BlockedRoleInfo>,
        logChannel: p.logChannel as string | undefined
    };
}
function isOwner(userId: string): boolean {
    const cfg: any = loadConfig();
    return Array.isArray(cfg.owners) && cfg.owners.includes(userId);
}
export function registerProtectionListener(client: any) {
    client.on(Events.GuildMemberUpdate, async (oldMember: GuildMember | any, newMember: GuildMember) => {
        try {
            if (!newMember || !newMember.guild)
                return;
            const { botRoles, blockedRoles, alertRole, alertUsers, logChannel } = getProtectionConfig();
            const leaderUsers: string[] = (loadConfig() as any).protection?.leaderUsers || [];
            const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            if (!added.size) return;

            // Aguarda um curto período para garantir que o audit log já foi persistido pela API
            await new Promise(res => setTimeout(res, 750));

            // Mapeia roleId -> executorId usando um único fetch de audit log para reduzir chamadas e evitar condições de corrida
            const roleExecutorMap: Record<string, string | null> = {};
            const MEMBER_ROLE_UPDATE_TYPE: any = 25; // Fallback para tipo de atualização de cargos em versões estáveis
            try {
                const audit = await newMember.guild.fetchAuditLogs({ type: MEMBER_ROLE_UPDATE_TYPE, limit: 20 });
                for (const entry of audit.entries.values()) {
                    if ((entry as any).target?.id !== newMember.id) continue;
                    const changes: any[] = (entry as any).changes || [];
                    for (const c of changes) {
                        if (c.key === '$add') {
                            const arr = c['new'] || c['new_value'];
                            if (Array.isArray(arr)) {
                                for (const r of arr) {
                                    if (!roleExecutorMap[r.id]) {
                                        roleExecutorMap[r.id] = entry.executor?.id || null;
                                    }
                                }
                            }
                        }
                    }
                }
            } catch {
                // fallback silent
            }

            // Fallback adicional: se nenhum executor detectado, tenta outra busca após pequeno delay
            if (Object.keys(roleExecutorMap).length === 0) {
                await new Promise(res => setTimeout(res, 1200));
                try {
                    const audit2 = await newMember.guild.fetchAuditLogs({ type: MEMBER_ROLE_UPDATE_TYPE, limit: 20 });
                    for (const entry of audit2.entries.values()) {
                        if ((entry as any).target?.id !== newMember.id) continue;
                        const changes: any[] = (entry as any).changes || [];
                        for (const c of changes) {
                            if (c.key === '$add') {
                                const arr = c['new'] || c['new_value'];
                                if (Array.isArray(arr)) {
                                    for (const r of arr) {
                                        if (!roleExecutorMap[r.id]) {
                                            roleExecutorMap[r.id] = entry.executor?.id || null;
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch {}
            }

            // Pré-carrega lista dinâmica de cargos protegidos globais (hierarquia principal)
            const rootCfg: any = loadConfig();
            const globalProtectedRoleIds: Set<string> = new Set(Object.values(rootCfg.roles || {}).map((v: any) => String(v)));
            const leadershipRoleIds: Set<string> = new Set([
                ...(Object.values(rootCfg.protection?.areaLeaderRoles || {}).map((v: any) => String(v))),
                '1411223951350435961' // Líder Geral (fixo no config atual)
            ]);

            for (const role of added.values()) {
                // Log passivo para cargos VIP ou de permissão (não remove)
                const vipRoleIds = new Set(Object.values(rootCfg.vipRoles || {}).map((v: any) => String(v)));
                const permissionRoleIds = new Set((rootCfg.permissionRoles || []).map((v: any) => String(v)));
                const isVip = vipRoleIds.has(role.id);
                const isPerm = permissionRoleIds.has(role.id);
                if (isVip || isPerm) {
                    const executorIdPassive = roleExecutorMap[role.id] ?? null;
                    const cfg: any = loadConfig();
                    const mainGuildId = cfg.mainGuildId;
                    if (newMember.guild.id === mainGuildId) {
                        const logChannelId = getProtectionConfig().logChannel || '1414540666171559966';
                        try {
                            const ch: any = await newMember.guild.channels.fetch(logChannelId).catch(() => null);
                            if (ch && ch.isTextBased()) {
                                const embed = new EmbedBuilder()
                                    .setTitle('<:z_mod_DiscordShield:934654129811357726> Proteção de Cargos • Registro')
                                    .setColor(isVip ? 0x9B59B6 : 0x3498DB)
                                    .setDescription('Um cargo monitorado (VIP ou Permissão) foi adicionado e apenas registrado.')
                                    .addFields(
                                        { name: 'Usuário', value: `<@${newMember.id}>\n\`${newMember.id}\`` },
                                        { name: 'Executor', value: executorIdPassive ? `<@${executorIdPassive}>\n\`${executorIdPassive}\`` : 'Desconhecido' },
                                        { name: 'Cargo', value: `<@&${role.id}>\n\`${role.id}\`` },
                                        { name: 'Tipo', value: isVip ? 'VIP' : 'Permissão' },
                                        { name: 'Ação', value: 'Não fiz nada, apenas registrei' },
                                        { name: 'Horário', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
                                    )
                                    .setFooter({ text: 'Sistema de Proteção de Cargos' })
                                    .setTimestamp();
                                ch.send({ embeds: [embed] }).catch(() => { });
                            }
                        } catch { }
                    }
                    // Não executar remoção para estes cargos
                    continue;
                }
                let blockInfo = blockedRoles[role.id];
                const isGlobalHierarchy = globalProtectedRoleIds.has(role.id);
                if (!blockInfo && isGlobalHierarchy) {
                    // Cria info sintética para aplicar fluxo de proteção
                    blockInfo = { name: 'Hierarquia Global' } as BlockedRoleInfo;
                }
                if (!blockInfo) continue; // nada a proteger
                let executorId: string | null = roleExecutorMap[role.id] ?? null;
                let allowed = false;
                if (executorId) {
                    if (isOwner(executorId)) {
                        allowed = true;
                    }
                    else {
                        const execMember = newMember.guild.members.cache.get(executorId) || await newMember.guild.members.fetch(executorId).catch(() => null);
                        if (execMember) {
                            const botId = (loadConfig() as any).botId;
                            if (botId && executorId === botId) {
                                allowed = true;
                            }
                            if (botRoles.some((id: string) => execMember.roles.cache.has(id))) {
                                allowed = true;
                            }
                            else if (leaderUsers.includes(executorId) && role.id !== '1411223951350435961') {
                                allowed = true;
                            }
                            else if (blockInfo.allowedLeaderRoles && blockInfo.allowedLeaderRoles.length) {
                                if (blockInfo.allowedLeaderRoles.some(rid => execMember.roles.cache.has(rid)))
                                    allowed = true;
                            }
                            else if (blockInfo.allowedLeaderRole) {
                                if (execMember.roles.cache.has(blockInfo.allowedLeaderRole))
                                    allowed = true;
                            }
                            // Regra especial: qualquer cargo da hierarquia global só pode ser aplicado por liderança (todas) ou líder geral
                            if (!allowed && isGlobalHierarchy) {
                                if (Array.from(leadershipRoleIds).some(rid => execMember.roles.cache.has(rid))) {
                                    allowed = true;
                                }
                            }
                        }
                    }
                }
                if (!executorId) {
                    logger.info({ user: newMember.id, role: role.id, roleName: blockInfo.name }, 'Proteção: cargo bloqueado detectado mas ignorado (executor ausente no audit log)');
                    continue;
                }
                if (!allowed) {
                    await newMember.roles.remove(role.id).catch(() => { });
                    logger.warn({ user: newMember.id, role: role.id, roleName: blockInfo.name, executorId }, 'Proteção: cargo bloqueado removido');
                    const cfg: any = loadConfig();
                    const mainGuildId = cfg.mainGuildId;
                    const logChannelId = logChannel || '1414540666171559966';
                    if (newMember.guild.id === mainGuildId) {
                        try {
                            const ch: any = await newMember.guild.channels.fetch(logChannelId).catch(() => null);
                            if (ch && ch.isTextBased()) {
                                const embed = new EmbedBuilder()
                                    .setTitle('<:z_mod_DiscordShield:934654129811357726> Proteção de Cargos • Ação Executada')
                                    .setColor(0xE74C3C)
                                    .setDescription(`Um cargo protegido foi aplicado de forma não autorizada e removido imediatamente.`)
                                    .addFields({ name: '<a:vSETAverdeclaro:1386504186396676141> Usuário Afetado', value: `<@${newMember.id}>\n\`${newMember.id}\`` }, { name: '<a:vSETAverdeclaro:1386504186396676141> Executor', value: executorId ? `<@${executorId}>\n\`${executorId}\`` : 'Desconhecido' }, { name: '<a:vSETAverdeclaro:1386504186396676141> Cargo Bloqueado', value: `<@&${role.id}>\n\`${role.id}\`` }, { name: '<a:vSETAverdeclaro:1386504186396676141> Identificação', value: `Nome interno: **${blockInfo.name}**` }, { name: '<a:vSETAverdeclaro:1386504186396676141> Ação', value: 'Cargo removido automaticamente' }, { name: '<a:vSETAverdeclaro:1386504186396676141> Horário', value: `<t:${Math.floor(Date.now() / 1000)}:F>` })
                                    .setFooter({ text: 'Sistema de Proteção de Cargos' })
                                    .setTimestamp();
                                const execMember = executorId ? await newMember.guild.members.fetch(executorId).catch(() => null) : null;
                                if (execMember?.user?.avatarURL())
                                    embed.setThumbnail(execMember.user.avatarURL()!);
                                const mentionContent = `${alertRole ? `<@&${alertRole}>` : ''} ${alertUsers.map(id => `<@${id}>`).join(' ')}`.trim();
                                ch.send({ content: mentionContent, embeds: [embed] }).catch(() => { });
                            }
                        }
                        catch { }
                    }
                }
            }
        }
        catch (err) {
            logger.error({ err }, 'Erro proteção de cargos');
        }
    });
}
