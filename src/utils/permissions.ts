import { GuildMember, Client } from 'discord.js';
import { loadConfig } from '../config/index.ts';
function norm(str: string) { return (str || '').trim().toLowerCase(); }
function getOwners() {
    const cfg: any = loadConfig();
    return Array.isArray(cfg.owners) ? cfg.owners : [];
}
export function isOwner(member: GuildMember | null | undefined) {
    if (!member)
        return false;
    return getOwners().includes(member.id);
}
export function isAdminFromMember(member: GuildMember | null | undefined) {
    if (isOwner(member))
        return true;
    if (!member)
        return false;
    const cfg: any = loadConfig();
    const adminRole = cfg.roles?.admin;
    if (adminRole && member.roles.cache.has(adminRole))
        return true;
    return member.permissions?.has('Administrator');
}
export function getAreaConfigByName(areaName: string) {
    const cfg: any = loadConfig();
    return (cfg.areas || []).find((a: any) => norm(a.name) === norm(areaName));
}
export function isAreaLeader(member: GuildMember | null | undefined, areaName: string) {
    if (!member)
        return false;
    const area = getAreaConfigByName(areaName);
    if (!area?.roleIds?.lead)
        return false;
    return member.roles.cache.has(area.roleIds.lead);
}
export function isExtraAreaManager(member: GuildMember | null | undefined, areaName: string) {
    if (!member)
        return false;
    const cfg: any = loadConfig();
    const areaCfg = getAreaConfigByName(areaName);
    if (!areaCfg)
        return false;
    const extras: Record<string, string[] | undefined> = (cfg.permissions?.points?.extraManagers) || {};
    const key = (areaCfg.name || '').toUpperCase();
    const roles = extras[key];
    if (!roles || roles.length === 0)
        return false;
    return roles.some(rid => member.roles.cache.has(rid));
}
export function getMemberLeaderAreas(member: GuildMember | null | undefined) {
    if (!member)
        return [] as string[];
    const cfg: any = loadConfig();
    const out: string[] = [];
    for (const a of (cfg.areas || [])) {
        if (a.roleIds?.lead && member.roles.cache.has(a.roleIds.lead))
            out.push(a.name);
    }
    return out;
}
export function getMemberExtraManagedAreas(member: GuildMember | null | undefined) {
    if (!member)
        return [] as string[];
    const cfg: any = loadConfig();
    const extras: Record<string, string[] | undefined> = (cfg.permissions?.points?.extraManagers) || {};
    const out: string[] = [];
    for (const [area, roleIds] of Object.entries(extras)) {
        if (!roleIds || roleIds.length === 0)
            continue;
        if (roleIds.some(rid => member.roles.cache.has(rid)))
            out.push(area);
    }
    return out;
}
export function hasAnyLeadership(member: GuildMember | null | undefined) {
    return getMemberLeaderAreas(member).length > 0;
}
export async function hasCrossGuildLeadership(client: Client, userId: string) {
    const cfg: any = loadConfig();
    const areas = cfg.areas || [];
    for (const area of areas) {
        const leadRole = area?.roleIds?.lead;
        const guildId = area?.guildId;
        if (!leadRole || !guildId)
            continue;
        try {
            const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member && member.roles.cache.has(leadRole))
                return true;
        }
        catch { }
    }
    return false;
}
export function assertAreaPermission(member: GuildMember | null | undefined, areaName: string) {
    if (isOwner(member))
        return true;
    return isAdminFromMember(member) || isAreaLeader(member, areaName) || isExtraAreaManager(member, areaName);
}
export function canManageAnyArea(member: GuildMember | null | undefined) {
    return isOwner(member);
}
export async function canUsePdfForArea(member: GuildMember | null | undefined, areaName: string) {
    if (isOwner(member))
        return true;
    if (!member)
        return false;
    const area = getAreaConfigByName(areaName);
    const leadRole = area?.roleIds?.lead;
    const guildId = area?.guildId;
    if (!leadRole || !guildId)
        return false;
    // Local guild check first
    if (member.roles.cache.has(leadRole))
        return true;
    // Cross-guild: check the area guild
    try {
        const guild = member.client.guilds.cache.get(guildId) || await member.client.guilds.fetch(guildId);
        const areaMember = await guild.members.fetch(member.id).catch(() => null);
        if (areaMember && areaMember.roles.cache.has(leadRole))
            return true;
    }
    catch { }
    return false;
}
export function canUseRppArea(member: GuildMember | null | undefined, areaName: string) {
    if (isOwner(member))
        return true;
    return isAreaLeader(member, areaName);
}
