import { RPPRepository } from '../repositories/rppRepository.ts';
import { logger } from '../utils/logger.ts';
import { Client, Guild } from 'discord.js';
import { RppSnapshotRepository } from '../repositories/rppSnapshotRepository.ts';
import { loadConfig } from '../config/index.ts';
export class RPPService {
    constructor(private repo = new RPPRepository()) { }
    async requestRPP(userId: string, reason?: string, returnDate?: string) {
        const record = await this.repo.create({
            user_id: userId,
            status: 'PENDING',
            requested_at: new Date().toISOString(),
            reason,
            return_date: returnDate
        });
        logger.info({ record }, 'Pedido de RPP criado');
        return record;
    }
    async accept(id: number | string, moderatorId: string) {
        await this.repo.updateStatus(id, 'ACCEPTED', moderatorId);
        logger.info({ id, moderatorId }, 'RPP aceito');
    }
    async reject(id: number | string, moderatorId: string) {
        await this.repo.updateStatus(id, 'REJECTED', moderatorId);
        logger.info({ id, moderatorId }, 'RPP rejeitado');
    }
    async pendingList() {
        return this.repo.listPending();
    }
    async hasPending(userId: string) {
        return !!(await this.repo.findPendingByUser(userId));
    }
    async hasActive(userId: string) {
        return !!(await (this.repo as any).findActiveByUser(userId));
    }
    async activatePending(userId: string, moderatorId: string) {
        const pending = await this.repo.findPendingByUser(userId);
        if (!pending)
            return false;
        await this.repo.updateStatus(pending.id!, 'ACCEPTED', moderatorId);
        return true;
    }
    async removeActive(userId: string, moderatorId: string) {
        await this.repo.markRemoved(userId, moderatorId);
    }
    async listActive(userIds?: string[]) {
        return this.repo.listActive(userIds);
    }
    async listActivePaged(page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            this.repo.listActivePaged(pageSize, offset),
            this.repo.countActive()
        ]);
        return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
    }
    async listRemovedPaged(page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            this.repo.listRemovedPaged(pageSize, offset),
            this.repo.countRemoved()
        ]);
        return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
    }
    async resetAll() {
        await (this.repo as any).clearAll();
        logger.warn('Todos os RPPs foram removidos!');
    }
}
export interface RppRoleSnapshot {
    userId: string;
    roles: string[];
    storedAt: string;
}
export const inMemorySnapshots: Record<string, RppRoleSnapshot> = {};
export async function applyRppEntryRoleAdjust(client: Client, userId: string) {
    const cfg: any = loadConfig();
    const mainGuildId = cfg.mainGuildId;
    // try configured main guild first; if not found, fall back to discovering the guild where the member exists
    let guild: Guild | null = null;
    if (mainGuildId) {
        guild = await client.guilds.fetch(mainGuildId).catch(() => null);
    }
    let member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!guild || !member) {
        // fallback: scan cached guilds to find the member
        const candidates: Array<{ g: Guild; m: any }> = [];
        for (const g of client.guilds.cache.values()) {
            const m = await g.members.fetch(userId).catch(() => null);
            if (m) candidates.push({ g, m });
        }
        // Prefer the guild that contains the global leader role (main guild)
        const leaderGeneralRole = String(cfg.protectionRoles?.leaderGeneral || '1411223951350435961');
        let chosen = null as null | { g: Guild; m: any };
        for (const c of candidates) {
            await c.g.roles.fetch().catch(() => null);
            if (c.g.roles.cache.has(leaderGeneralRole)) {
                chosen = c; break;
            }
        }
        if (!chosen) chosen = candidates[0] || null;
        if (chosen) { guild = chosen.g; member = chosen.m; }
    }
    if (!guild || !member)
        return;
    const staffGlobalRole = cfg.roles?.staff;
    const recoveryRole = cfg.rppRoles?.recovery || '1136856157835763783';
    const permissionRoles = cfg.permissionRoles || ['1156383581099274250', '1080746284434071582', '1104523865377488918', '1136699869290041404'];
    const monitorRole = '1137028161750716426';
    const leadershipRoles = Object.values(cfg.protection?.areaLeaderRoles || {}).map((v: any) => String(v));
    const generalLeaderRole = cfg.protectionRoles?.leaderGeneral || '1411223951350435961';
    const MAIN_AREA_ROLES: string[] = cfg.rppRoles?.mainAreaRoles || [
        '1136861840421425284', '1170196352114901052', '1136861814328668230', '1136868804677357608', '1136861844540227624', '1247967720427884587'
    ];
    const rankRoleIds: string[] = Object.entries(cfg.roles || {}).filter(([k]) => k !== 'staff').map(([, v]) => String(v));
    const toRemove: string[] = [];
    if (staffGlobalRole && member.roles.cache.has(staffGlobalRole))
        toRemove.push(staffGlobalRole);
    for (const rid of MAIN_AREA_ROLES)
        if (member.roles.cache.has(rid))
            toRemove.push(rid);
    for (const rid of rankRoleIds)
        if (member.roles.cache.has(rid))
            toRemove.push(rid);
    for (const rid of permissionRoles)
        if (member.roles.cache.has(rid))
            toRemove.push(rid);
    if (member.roles.cache.has(monitorRole))
        toRemove.push(monitorRole);
    for (const rid of leadershipRoles)
        if (member.roles.cache.has(rid))
            toRemove.push(rid);
    if (member.roles.cache.has(generalLeaderRole))
        toRemove.push(generalLeaderRole);
    const unique = [...new Set(toRemove)];
    inMemorySnapshots[userId] = { userId, roles: unique, storedAt: new Date().toISOString() };
    try {
        const repo = new RppSnapshotRepository();
        await repo.upsert(userId, unique);
    }
    catch { }
    for (const rid of unique) {
        try {
            await member.roles.remove(rid, 'RPP: removendo cargos temporariamente');
        }
        catch { }
    }
    if (!member.roles.cache.has(recoveryRole)) {
        try {
            await member.roles.add(recoveryRole, 'RPP: cargo temporário');
        }
        catch { }
    }
    return { removed: unique, added: recoveryRole };
}
export async function applyRppExitRoleRestore(client: Client, userId: string) {
    const cfg: any = loadConfig();
    const mainGuildId = cfg.mainGuildId;
    // try configured main guild first; if not found, fall back to discovering the guild where the member exists
    let guild: Guild | null = null;
    if (mainGuildId) {
        guild = await client.guilds.fetch(mainGuildId).catch(() => null);
    }
    let member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
    if (!guild || !member) {
        const candidates: Array<{ g: Guild; m: any }> = [];
        for (const g of client.guilds.cache.values()) {
            const m = await g.members.fetch(userId).catch(() => null);
            if (m) candidates.push({ g, m });
        }
        const leaderGeneralRole = String(cfg.protectionRoles?.leaderGeneral || '1411223951350435961');
        let chosen = null as null | { g: Guild; m: any };
        for (const c of candidates) {
            await c.g.roles.fetch().catch(() => null);
            if (c.g.roles.cache.has(leaderGeneralRole)) { chosen = c; break; }
        }
        if (!chosen) chosen = candidates[0] || null;
        if (chosen) { guild = chosen.g; member = chosen.m; }
    }
    if (!guild || !member)
        return;
    const recoveryRole = cfg.rppRoles?.recovery || '1136856157835763783';
    const repo = new RppSnapshotRepository();
    const snapshot = inMemorySnapshots[userId] || await repo.get(userId);
    if (snapshot) {
        for (const rid of snapshot.roles) {
            try {
                if (!member.roles.cache.has(rid))
                    await member.roles.add(rid, 'RPP encerrado: restaurando cargos');
            }
            catch { }
        }
        delete inMemorySnapshots[userId];
        try {
            await repo.delete(userId);
        }
        catch { }
    }
    if (member.roles.cache.has(recoveryRole)) {
        try {
            await member.roles.remove(recoveryRole, 'RPP encerrado: removendo cargo temporário');
        }
        catch { }
    }
}
