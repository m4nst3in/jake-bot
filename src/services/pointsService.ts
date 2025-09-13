import { PointRepository } from '../repositories/pointRepository.ts';
import { baseEmbed } from '../utils/embeds.ts';
import { sendPointsLog } from '../utils/pointsLogger.ts';
import { loadConfig } from '../config/index.ts';

// Public type for user profile area summary (used in return type inference)
export interface UserAreaSummary { area: string; points: number; reports: number; shifts: number; }
export class PointsService {
    constructor(private repo = new PointRepository()) { }
    async adicionar(userId: string, area: string, quantidade: number, reason: string, by: string) {
        await this.repo.addPoints(userId, area, quantidade, reason, by);
        const record = (this.repo as any).getUserArea ? await (this.repo as any).getUserArea(userId, area) : null;
        const c: any = (globalThis as any).client || undefined;
        if (c)
            await sendPointsLog(c, 'adicionado', { userId, moderatorId: by, area, delta: quantidade, reason, total: record?.points || 0 });
    }
    async remover(userId: string, area: string, quantidade: number, reason: string, by: string) {
        const delta = -Math.abs(quantidade);
        await this.repo.addPoints(userId, area, delta, reason, by);
        const record = (this.repo as any).getUserArea ? await (this.repo as any).getUserArea(userId, area) : null;
        const c: any = (globalThis as any).client || undefined;
        if (c)
            await sendPointsLog(c, 'removido', { userId, moderatorId: by, area, delta, reason, total: record?.points || 0 });
    }
    async registrarReport(userId: string, area: string, pontos: number, by: string) {
        await this.repo.addPoints(userId, area, pontos, 'report', by);
        const record = (this.repo as any).getUserArea ? await (this.repo as any).getUserArea(userId, area) : null;
        const c: any = (globalThis as any).client || undefined;
        if (c)
            await sendPointsLog(c, 'adicionado', { userId, moderatorId: by, area, delta: pontos, reason: 'report', total: record?.points || 0 });
    }
    async registrarPlantao(userId: string, area: string, pontos: number, by: string) {
        await (this.repo as any).addShift(userId, area, pontos, 'plantao', by);
        const record = await this.repo.getUserArea(userId, area);
        const c: any = (globalThis as any).client || undefined;
        if (c)
            await sendPointsLog(c, 'adicionado', { userId, moderatorId: by, area, delta: pontos, reason: 'plantao', total: record?.points || 0 });
    }
    async ranking(area: string) {
        const top = await this.repo.getTop(area, 10);
        const cfg: any = loadConfig();
        const excluded: Set<string> = new Set((cfg.ranking?.excludedUserIds || []) as string[]);
        const flame = cfg.emojis?.flame || '<a:Blue_Flame:placeholder>';
        const designEmote = cfg.emojis?.design || '<:Design:placeholder>';
        const filteredTop = top.filter((r: any) => !excluded.has(r.user_id));
        return baseEmbed({ title: `${designEmote} Ranking - ${area}`, description: filteredTop.map((r: any, i: number) => `${flame} **${i + 1}.** <@${r.user_id}> — ${r.points} pts`).join('\n') || 'Sem dados ainda', color: 0xf1c40f });
    }
    async richRanking(area: string) {
        const [top, total] = await Promise.all([this.repo.getTop(area, 200), this.repo.countArea(area)]);
        const cfg: any = loadConfig();
        const excluded: Set<string> = new Set((cfg.ranking?.excludedUserIds || []) as string[]);
        const flame = cfg.emojis?.flame || '<a:Blue_Flame:placeholder>';
        const designEmote = cfg.emojis?.design || '<:Design:placeholder>';
        let extended: any[] = [...top];
        try {
            const areaCfg = (cfg.areas || []).find((a: any) => a.name.toLowerCase() === area.toLowerCase());
            if (areaCfg?.guildId && areaCfg?.roleIds?.member) {
                const c: any = (globalThis as any).client;
                const g = c?.guilds?.cache?.get(areaCfg.guildId) || await c?.guilds?.fetch?.(areaCfg.guildId).catch(() => null);
                if (g) {
                    await g.members.fetch();
                    extended = extended.filter(r => g.members.cache.has(r.user_id));
                    const memberRoleId = areaCfg.roleIds.member;
                    const leadRoleId = areaCfg.roleIds.lead;
                    const owners: string[] = cfg.owners || [];
                    const alwaysShow: string[] = (cfg.ranking?.alwaysShowOwnerIds) || [];
                    const existingIds = new Set(extended.map(r => r.user_id));
                    g.members.cache.forEach((m: any) => {
                        if (excluded.has(m.id)) return; // never include excluded users
                        if (!m.roles.cache.has(memberRoleId))
                            return;
                        if (leadRoleId && m.roles.cache.has(leadRoleId) && !(extended.find(r => r.user_id === m.id && r.points > 0)))
                            return;
                        if (owners.includes(m.id) && !(extended.find(r => r.user_id === m.id && r.points > 0)) && !alwaysShow.includes(m.id))
                            return;
                        if (!existingIds.has(m.id)) {
                            extended.push({ user_id: m.id, points: 0, reports_count: 0, shifts_count: 0 });
                            existingIds.add(m.id);
                        }
                    });
                    extended = extended.filter(r => {
                        if (excluded.has(r.user_id)) return false; // filter excluded users
                        if (r.points > 0)
                            return true;
                        const mem = g.members.cache.get(r.user_id);
                        if (!mem)
                            return true;
                        if (leadRoleId && mem.roles.cache.has(leadRoleId))
                            return false;
                        if ((cfg.owners || []).includes(r.user_id) && !alwaysShow.includes(r.user_id))
                            return false;
                        return true;
                    });
                }
            }
        }
        catch { }
        extended.sort((a, b) => (b.points || 0) - (a.points || 0));
        const filtered = extended.filter((r: any) => !excluded.has(r.user_id));
        const lines = filtered.map((r: any, i: number) => {
            const base = `${flame} **${i + 1}.** <@${r.user_id}> — **${r.points}** pts`;
            if (area === 'Recrutamento') {
                return `${base} • 🕒 ${r.shifts_count || 0} plant.`;
            }
            return base;
        });
        return baseEmbed({
            title: `${designEmote} Ranking • ${area}`,
            description: lines.join('\n') || 'Sem participantes ainda',
            color: 0x5865F2,
            footer: `Total de participantes: ${filtered.length}`
        });
    }
    async buildRankingEmbedUnified(area: string) {
        return area === 'Suporte' ? await this.richRankingSuporte() : await this.richRanking(area);
    }
    async adicionarComRelatorio(userId: string, area: string, pontos: number, by: string) {
        await (this.repo as any).addPointsAndReport(userId, area, pontos, 'relatorio_banca', by);
        const record = await this.repo.getUserArea(userId, area);
        const c: any = (globalThis as any).client || undefined;
        if (c)
            await sendPointsLog(c, 'adicionado', { userId, moderatorId: by, area, delta: pontos, reason: 'Relatório em Banca', total: record?.points || 0 });
    }
    async richRankingSuporte() {
        const area = 'Suporte';
        const [top, total, totalReports] = await Promise.all([
            this.repo.getTop(area, 200),
            this.repo.countArea(area),
            (this.repo as any).sumReports(area)
        ]);
        const cfg: any = loadConfig();
        const excluded: Set<string> = new Set((cfg.ranking?.excludedUserIds || []) as string[]);
        const flame = cfg.emojis?.flame || '<a:Blue_Flame:placeholder>';
        const designEmote = cfg.emojis?.design || '<:Design:placeholder>';
        let extended: any[] = [...top];
        try {
            const areaCfg = (cfg.areas || []).find((a: any) => a.name === 'SUPORTE');
            if (areaCfg?.guildId && areaCfg?.roleIds?.member) {
                const c: any = (globalThis as any).client;
                const g = c?.guilds?.cache?.get(areaCfg.guildId) || await c?.guilds?.fetch?.(areaCfg.guildId).catch(() => null);
                if (g) {
                    await g.members.fetch();
                    extended = extended.filter(r => g.members.cache.has(r.user_id));
                    const memberRoleId = areaCfg.roleIds.member;
                    const leadRoleId = areaCfg.roleIds.lead;
                    const owners: string[] = cfg.owners || [];
                    const alwaysShow: string[] = (cfg.ranking?.alwaysShowOwnerIds) || [];
                    const existingIds = new Set(extended.map(r => r.user_id));
                    g.members.cache.forEach((m: any) => {
                        if (excluded.has(m.id)) return; // never include excluded users
                        if (!m.roles.cache.has(memberRoleId))
                            return;
                        if (leadRoleId && m.roles.cache.has(leadRoleId) && !(extended.find(r => r.user_id === m.id && r.points > 0)))
                            return;
                        if (owners.includes(m.id) && !(extended.find(r => r.user_id === m.id && r.points > 0)) && !alwaysShow.includes(m.id))
                            return;
                        if (!existingIds.has(m.id)) {
                            extended.push({ user_id: m.id, points: 0, reports_count: 0, shifts_count: 0 });
                            existingIds.add(m.id);
                        }
                    });
                    extended = extended.filter(r => {
                        if (excluded.has(r.user_id)) return false; // filter excluded users
                        if (r.points > 0)
                            return true;
                        const mem = g.members.cache.get(r.user_id);
                        if (!mem)
                            return true;
                        if (leadRoleId && mem.roles.cache.has(leadRoleId))
                            return false;
                        if ((cfg.owners || []).includes(r.user_id) && !alwaysShow.includes(r.user_id))
                            return false;
                        return true;
                    });
                }
            }
        }
        catch { }
        extended.sort((a, b) => (b.points || 0) - (a.points || 0));
        const filtered = extended.filter((r: any) => !excluded.has(r.user_id));
        const lines = filtered.map((r: any, i: number) => `${flame} **${i + 1}.** <@${r.user_id}> — **${r.points}** pts • 🧾 ${r.reports_count || 0} rel. • 🕒 ${r.shifts_count || 0} plant.`);
        return baseEmbed({
            title: `${designEmote} Ranking de Suporte`,
            description: lines.join('\n') || 'Sem participantes ainda',
            color: 0x2b2d31,
            footer: `Participantes: ${filtered.length} • Relatórios: ${totalReports}`
        });
    }
    async resetAll() { await (this.repo as any).resetAllPoints(); }
    async resetArea(area: string) { await (this.repo as any).resetArea(area); }
    async getUserProfile(userId: string) {
        const all: any[] = await (this.repo as any).getUserAllAreas(userId);
        const areas: UserAreaSummary[] = all.map((r: any) => ({ area: r.area, points: r.points || 0, reports: r.reports_count || 0, shifts: r.shifts_count || 0 }))
            .sort((a: UserAreaSummary, b: UserAreaSummary) => b.points - a.points);
        const total = areas.reduce((s: number, a: UserAreaSummary) => s + a.points, 0);
        return { areas, total };
    }
}
