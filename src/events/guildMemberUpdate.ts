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
               const rootCfg: any = loadConfig();
            const mainGuildId = rootCfg.mainGuildId;
            // --- Proteção Anti-Remoção de Cargo Membro ---
            const MEMBER_PROTECTED_ROLE_ID = '934635845690990632';
            // Se o cargo protegido estava antes e não está mais agora => tentativa de remoção
            if (oldMember?.roles?.cache?.has(MEMBER_PROTECTED_ROLE_ID) && !newMember.roles.cache.has(MEMBER_PROTECTED_ROLE_ID)) {
                let executorId: string | null = null;
                try {
                    const audit = await newMember.guild.fetchAuditLogs({ type: 25, limit: 15 }); // MEMBER_ROLE_UPDATE
                    for (const entry of audit.entries.values()) {
                        if ((entry as any).target?.id !== newMember.id) continue;
                        const changes: any[] = (entry as any).changes || [];
                        for (const c of changes) {
                            if (c.key === '$remove') {
                                const removedArr = c['new'] || c['new_value'];
                                if (Array.isArray(removedArr) && removedArr.some((r: any) => r.id === MEMBER_PROTECTED_ROLE_ID)) {
                                    executorId = entry.executor?.id || null;
                                    break;
                                }
                            }
                        }
                        if (executorId) break;
                    }
                } catch {}
                const isOwnerExecutor = executorId ? (Array.isArray(rootCfg.owners) && rootCfg.owners.includes(executorId)) : false;
                // Liderança = qualquer cargo em protection.areaLeaderRoles ou cargo global líder geral
                const leadershipRoleIds: Set<string> = new Set([
                    ...(Object.values(rootCfg.protection?.areaLeaderRoles || {}).map((v: any) => String(v))),
                    '1411223951350435961'
                ]);
                let isLeadershipExecutor = false;
                if (executorId) {
                    try {
                        const execMember = await newMember.guild.members.fetch(executorId).catch(() => null);
                        if (execMember) {
                            if (Array.from(leadershipRoleIds).some(r => execMember.roles.cache.has(r))) {
                                isLeadershipExecutor = true;
                            }
                        }
                    } catch {}
                }
                const allowedRemoval = isOwnerExecutor || isLeadershipExecutor;
                if (!allowedRemoval) {
                    // Restaura cargo
                    await newMember.roles.add(MEMBER_PROTECTED_ROLE_ID, 'Proteção: cargo membro restaurado automaticamente').catch(() => { });
                    // Loga no canal de proteção somente no servidor principal
                    if (newMember.guild.id === mainGuildId) {
                        const logChannelId = logChannel || '1414540666171559966';
                        try {
                            const ch: any = await newMember.guild.channels.fetch(logChannelId).catch(() => null);
                            if (ch && ch.isTextBased()) {
                                const embed = new EmbedBuilder()
                                    .setTitle('<:z_mod_DiscordShield:934654129811357726> Proteção de Cargos • Remoção Bloqueada')
                                    .setColor(0xE67E22)
                                    .setDescription('O cargo de membro foi removido e restaurado automaticamente.')
                                    .addFields(
                                        { name: 'Usuário', value: `<@${newMember.id}>\n\`${newMember.id}\`` },
                                        { name: 'Executor', value: executorId ? `<@${executorId}>\n\`${executorId}\`` : 'Desconhecido' },
                                        { name: 'Cargo Restaurado', value: `<@&${MEMBER_PROTECTED_ROLE_ID}>\n\`${MEMBER_PROTECTED_ROLE_ID}\`` },
                                        { name: 'Ação', value: 'Remoção revertida (não autorizado)' },
                                        { name: 'Horário', value: `<t:${Math.floor(Date.now() / 1000)}:F>` }
                                    )
                                    .setTimestamp();
                                const mentionContent = `${alertRole ? `<@&${alertRole}>` : ''} ${alertUsers.map(id => `<@${id}>`).join(' ')}`.trim();
                                ch.send({ content: mentionContent, embeds: [embed] }).catch(() => { });
                            }
                        } catch {}
                    }
                }
            }
            const leaderUsers: string[] = (loadConfig() as any).protection?.leaderUsers || [];
            const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
            if (!added.size)
                return;
            await new Promise(res => setTimeout(res, 750));
            const roleExecutorMap: Record<string, string | null> = {};
            const MEMBER_ROLE_UPDATE_TYPE: any = 25;
            try {
                const audit = await newMember.guild.fetchAuditLogs({ type: MEMBER_ROLE_UPDATE_TYPE, limit: 20 });
                for (const entry of audit.entries.values()) {
                    if ((entry as any).target?.id !== newMember.id)
                        continue;
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
            }
            catch {
            }
            if (Object.keys(roleExecutorMap).length === 0) {
                await new Promise(res => setTimeout(res, 1200));
                try {
                    const audit2 = await newMember.guild.fetchAuditLogs({ type: MEMBER_ROLE_UPDATE_TYPE, limit: 20 });
                    for (const entry of audit2.entries.values()) {
                        if ((entry as any).target?.id !== newMember.id)
                            continue;
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
                }
                catch { }
            }
            // rootCfg já definido anteriormente
            const globalProtectedRoleIds: Set<string> = new Set(Object.values(rootCfg.roles || {}).map((v: any) => String(v)));
            const leadershipRoleIds: Set<string> = new Set([
                ...(Object.values(rootCfg.protection?.areaLeaderRoles || {}).map((v: any) => String(v))),
                '1411223951350435961'
            ]);
            // Detecta cargo de Liderança de Recrutamento (heurística: nome 'Recrutamento' com allowedLeaderRole = Líder Geral)
            let recruitmentLeadershipRoleId: string | undefined;
            for (const [rid, info] of Object.entries((rootCfg.protection?.blockedRoles) || {})) {
                if ((info as any).name === 'Recrutamento' && (info as any).allowedLeaderRole === '1411223951350435961') {
                    recruitmentLeadershipRoleId = rid;
                    break;
                }
            }
            const staffRoleId = rootCfg.roles?.staff;
            const inicianteRoleId = rootCfg.roles?.['Iniciante'];
            const allowedTeamNamesForRecruitLead = new Set(['Mov Call','Design','Recrutamento','Eventos','Jornalismo']); // exclui Migração e Suporte
            async function resolveExecutorForRole(roleId: string): Promise<string | null> {
                if (roleExecutorMap[roleId])
                    return roleExecutorMap[roleId];
                const MEMBER_ROLE_UPDATE_TYPE: any = 25;
                const delays = [500, 1200, 2500];
                for (const d of delays) {
                    await new Promise(r => setTimeout(r, d));
                    try {
                        const audit = await newMember.guild.fetchAuditLogs({ type: MEMBER_ROLE_UPDATE_TYPE, limit: 50 });
                        for (const entry of audit.entries.values()) {
                            if ((entry as any).target?.id !== newMember.id)
                                continue;
                            const changes: any[] = (entry as any).changes || [];
                            for (const c of changes) {
                                if (c.key === '$add') {
                                    const arr = c['new'] || c['new_value'];
                                    if (Array.isArray(arr) && arr.some((r: any) => r.id === roleId)) {
                                        const execId = entry.executor?.id || null;
                                        if (execId) {
                                            roleExecutorMap[roleId] = execId;
                                            return execId;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    catch { }
                }
                return null;
            }
            const MIG_GLOBAL_ROLE = '1346223411289919558';
            const hierarchyOrder: string[] = Array.isArray(rootCfg.hierarchyOrder) && rootCfg.hierarchyOrder.length
                ? rootCfg.hierarchyOrder
                : [
                    'Iniciante', 'Aprendiz', 'Recruta', 'Cadete', 'Soldado', 'Cabo', '3 Sargento', '2 Sargento', '1 Sargento', 'Sub Oficial', 'Sub Tenente', 'Aspirante a Oficial', 'Intendente', '2 Tenente', '1 Tenente', 'Capitão', 'Capitão de Corveta', 'Major', 'Oficial de Guerra', 'Tenente Coronel', 'Coronel', 'Sub Comandante', 'Comandante', 'General de Brigada', 'General de Divisão', 'General de Esquadra', 'General de Exército', 'Contra-Almirante', 'Marechal', 'Almirante', 'Manager'
                ];
            const globalRoleNameById: Record<string, string> = (() => {
                const map: Record<string, string> = {};
                for (const [key, val] of Object.entries(rootCfg.roles || {})) {
                    map[String(val)] = key;
                }
                return map;
            })();
            const staffRankFallbacks: Record<string, string> = rootCfg.staffRankFallbacks || {};
            for (const role of added.values()) {
                const vipRoleIds = new Set(Object.values(rootCfg.vipRoles || {}).map((v: any) => String(v)));
                const permissionRoleIds = new Set((rootCfg.permissionRoles || []).map((v: any) => String(v)));
                const isVip = vipRoleIds.has(role.id);
                const isPerm = permissionRoleIds.has(role.id);
                if (isVip || isPerm) {
                    let executorIdPassive = roleExecutorMap[role.id] ?? null;
                    if (!executorIdPassive) {
                        executorIdPassive = await resolveExecutorForRole(role.id);
                    }
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
                                    .addFields({ name: '<a:cdwdsg_animatedarroworange:1305962425631379518> Usuário', value: `<@${newMember.id}>\n\`${newMember.id}\`` }, { name: '<a:cdwdsg_animatedarroworange:1305962425631379518> Executor', value: executorIdPassive ? `<@${executorIdPassive}>\n\`${executorIdPassive}\`` : 'Desconhecido' }, { name: '<a:cdwdsg_animatedarroworange:1305962425631379518> Cargo', value: `<@&${role.id}>\n\`${role.id}\`` }, { name: '<a:cdwdsg_animatedarroworange:1305962425631379518> Tipo', value: isVip ? 'VIP' : 'Permissão' }, { name: '<a:cdwdsg_animatedarroworange:1305962425631379518> Ação', value: 'Não fiz nada, apenas registrei' }, { name: '<a:cdwdsg_animatedarroworange:1305962425631379518> Horário', value: `<t:${Math.floor(Date.now() / 1000)}:F>` })
                                    .setFooter({ text: 'Sistema de Proteção de Cargos - CDW' })
                                    .setTimestamp();
                                ch.send({ embeds: [embed] }).catch(() => { });
                            }
                        }
                        catch { }
                    }
                    continue;
                }
                let blockInfo = blockedRoles[role.id];
                const isGlobalHierarchy = globalProtectedRoleIds.has(role.id);
                if (!blockInfo && isGlobalHierarchy) {
                    blockInfo = { name: 'Hierarquia Global' } as BlockedRoleInfo;
                }
                if (!blockInfo)
                    continue;
                let executorId: string | null = roleExecutorMap[role.id] ?? null;
                let allowed = false;
                const isMigrationGlobal = role.id === MIG_GLOBAL_ROLE;
                if (executorId) {
                    if (isOwner(executorId)) {
                        allowed = true;
                    }
                    else {
                        const execMember = newMember.guild.members.cache.get(executorId) || await newMember.guild.members.fetch(executorId).catch(() => null);
                        if (execMember) {
                            const execHasMigration = execMember.roles.cache.has(MIG_GLOBAL_ROLE);
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
                            // Regra: Liderança de Recrutamento pode aplicar Staff, Iniciante e cargos de equipes (exceto Migração e Suporte)
                            if (!allowed && recruitmentLeadershipRoleId && execMember.roles.cache.has(recruitmentLeadershipRoleId)) {
                                if (role.id === staffRoleId || role.id === inicianteRoleId || allowedTeamNamesForRecruitLead.has(blockInfo.name || '')) {
                                    allowed = true;
                                }
                            }
                            if (!allowed && isGlobalHierarchy) {
                                if (Array.from(leadershipRoleIds).some(rid => execMember.roles.cache.has(rid))) {
                                    allowed = true;
                                }
                            }
                            if (!allowed && execHasMigration && isGlobalHierarchy) {
                                const roleName = globalRoleNameById[role.id];
                                if (roleName) {
                                    const subCmdIndex = hierarchyOrder.indexOf('Sub Comandante');
                                    const targetIdx = hierarchyOrder.indexOf(roleName);
                                    if (targetIdx !== -1 && targetIdx < subCmdIndex) {
                                        allowed = true;
                                        const logChannelId = logChannel || '1414540666171559966';
                                        if (newMember.guild.id === (loadConfig() as any).mainGuildId) {
                                            try {
                                                const ch: any = await newMember.guild.channels.fetch(logChannelId).catch(() => null);
                                                if (ch && ch.isTextBased()) {
                                                    const embed = new EmbedBuilder()
                                                        .setTitle('<:z_mod_DiscordShield:934654129811357726> Proteção de Cargos • Registro')
                                                        .setColor(0x34495E)
                                                        .setDescription('Cargo de hierarquia aplicado por Migração (abaixo de Sub Comandante) – somente registro.')
                                                        .addFields({ name: 'Usuário', value: `<@${newMember.id}>\n\`${newMember.id}\`` }, { name: 'Executor', value: `<@${executorId}>\n\`${executorId}\`` }, { name: 'Cargo', value: `<@&${role.id}>\n\`${role.id}\`` }, { name: 'Ação', value: 'Não fiz nada, apenas registrei' })
                                                        .setTimestamp();
                                                    ch.send({ embeds: [embed] }).catch(() => { });
                                                }
                                            }
                                            catch { }
                                        }
                                        const fbRoleId = staffRankFallbacks[newMember.guild.id];
                                        if (fbRoleId && !newMember.roles.cache.has(fbRoleId)) {
                                            await newMember.roles.add(fbRoleId, 'Fallback de patente (Migração abaixo de Sub Comandante)').catch(() => { });
                                        }
                                    }
                                }
                            }
                            if (isMigrationGlobal && !isOwner(executorId)) {
                                allowed = false;
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
                                    .setFooter({ text: 'Sistema de Proteção de Cargos - CDW' })
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
