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
            if (!added.size)
                return;
            for (const role of added.values()) {
                const blockInfo = blockedRoles[role.id];
                if (!blockInfo)
                    continue;
                let executorId: string | null = null;
                try {
                    const audit = await newMember.guild.fetchAuditLogs({ type: 25, limit: 5 });
                    const entry = audit.entries.find(e => (e as any).target?.id === newMember.id && (e as any).changes?.some((c: any) => {
                        const addedArr = (c as any)['new'];
                        return c.key === '$add' && Array.isArray(addedArr) && addedArr.some((r: any) => r.id === role.id);
                    }));
                    if (entry)
                        executorId = entry.executor?.id || null;
                }
                catch { }
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
