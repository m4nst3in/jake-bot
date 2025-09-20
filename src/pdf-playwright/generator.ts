import { chromium, Browser, Page } from 'playwright';
import { Client, GuildMember } from 'discord.js';
import { loadConfig } from '../config/index.js';
import { DatabaseManager } from '../db/manager.js';
import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
interface MemberRow {
    user_id: string;
    points: number;
    reports_count: number;
    shifts_count: number;
    rankName?: string;
}
interface RankGoal {
    name: string;
    period: string;
    points?: number;
    reports?: number;
    upPoints?: number;
    maintainPoints?: number;
}
interface AreaGoals {
    ranks: RankGoal[];
    maintain?: any;
}
interface AreaTheme {
    primary: string;
    secondary: string;
    accent: string;
    name: string;
    icon: string;
    cssClass: string;
}
interface ParticipantData {
    username: string;
    userId: string;
    points: number;
    percentage: string;
    totalPercentage: string;
    reports?: number;
    shifts?: number;
    participation?: string;
    avatar?: string;
    initials: string;
    rank?: string;
    rankColor?: string;
    rankTextColor?: string;
    rankBorderColor?: string;
    rankBg?: string;
    metGoals: boolean;
    pointsGoal?: number;
    pointsGoalMet?: boolean;
    pointsNeeded?: number;
    reportsGoal?: number;
    reportsGoalMet?: boolean;
    reportsNeeded?: number;
    shiftsGoal?: number;
    shiftsGoalMet?: boolean;
    shiftsNeeded?: number;
    goal?: number;
    goalMet?: boolean;
    goalNeeded?: number;
    isTop1?: boolean;
    badgeText?: string;
}
interface TemplateData {
    title: string;
    styles: string;
    theme: string;
    icon: string;
    areaName: string;
    date: string;
    version: string;
    totalParticipants: string;
    totalPoints: string;
    avgPoints: string;
    medianPoints: string;
    maxPoints: string;
    isSupport: boolean;
    topParticipants: ParticipantData[];
    participants: ParticipantData[];
    pageNumber: number;
}
function getAreaTheme(area: string): AreaTheme {
    const themes: Record<string, AreaTheme> = {
        suporte: {
            primary: '#5865F2',
            secondary: '#E3E7FF',
            accent: '#4752C4',
            name: 'Suporte',
            icon: '🛠️',
            cssClass: 'suporte'
        },
        design: {
            primary: '#e67e22',
            secondary: '#ffe4cc',
            accent: '#d35400',
            name: 'Design',
            icon: '🎨',
            cssClass: 'design'
        },
        movcall: {
            primary: '#1abc9c',
            secondary: '#d8f7f1',
            accent: '#16a085',
            name: 'Mov Call',
            icon: '📞',
            cssClass: 'movcall'
        },
        recrutamento: {
            primary: '#9b59b6',
            secondary: '#f2e5f9',
            accent: '#8e44ad',
            name: 'Recrutamento',
            icon: '👥',
            cssClass: 'recrutamento'
        },
        eventos: {
            primary: '#f39c12',
            secondary: '#fef5e7',
            accent: '#e67e22',
            name: 'Eventos',
            icon: '🎉',
            cssClass: 'eventos'
        },
        jornalismo: {
            primary: '#34495e',
            secondary: '#ecf0f1',
            accent: '#2c3e50',
            name: 'Jornalismo',
            icon: '📰',
            cssClass: 'jornalismo'
        }
    };
    return themes[area.toLowerCase()] || {
        primary: '#2c3e50',
        secondary: '#ecf0f1',
        accent: '#34495e',
        name: area,
        icon: '📊',
        cssClass: 'default'
    };
}
async function fetchAreaRows(client: Client, area: string): Promise<MemberRow[]> {
    const sort = (a: MemberRow, b: MemberRow) => b.points - a.points;
    let rows: MemberRow[] = [];
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        const dbRows: any[] = await new Promise((resolve, reject) => {
            db.all('SELECT user_id, points, reports_count, shifts_count FROM points WHERE area=?', [area], (err: Error | null, r: any[]) => err ? reject(err) : resolve(r));
        });
        rows = dbRows as any;
    }
    else {
        const db = DatabaseManager.getMongo().database;
        const docs = await db.collection('points').find({ area }).project({ user_id: 1, points: 1, reports_count: 1, shifts_count: 1 }).toArray();
        rows = docs as any;
    }
    try {
        const cfg: any = loadConfig();
        let mainGuild: any = null;
        if (cfg.mainGuildId) {
            mainGuild = client.guilds.cache.get(cfg.mainGuildId) || await client.guilds.fetch(cfg.mainGuildId).catch(() => null);
            if (mainGuild) {
                await mainGuild.members.fetch();
            }
        }
        const areaCfg = (cfg.areas || []).find((a: any) => a.name.toLowerCase() === area.toLowerCase());
        if (areaCfg?.guildId && areaCfg?.roleIds?.member) {
            const g = client.guilds.cache.get(areaCfg.guildId) || await client.guilds.fetch(areaCfg.guildId).catch(() => null);
            if (g) {
                await g.members.fetch();
                rows = rows.filter(r => g.members.cache.has(r.user_id));
                const memberRoleId = areaCfg.roleIds.member;
                const leadRoleId = areaCfg.roleIds.lead;
                const owners: string[] = cfg.owners || [];
                const existing = new Set(rows.map(r => r.user_id));
                rows = rows.filter(r => {
                    const m = g.members.cache.get(r.user_id);
                    if (!m)
                        return false;
                    if (owners.includes(r.user_id))
                        return false;
                    if (leadRoleId && m.roles.cache.has(leadRoleId))
                        return false;
                    return true;
                });
                g.members.cache.forEach(m => {
                    if (!m.roles.cache.has(memberRoleId))
                        return;
                    const rec = rows.find(r => r.user_id === m.id);
                    const hasPoints = !!rec && rec.points > 0;
                    if (!hasPoints) {
                        if (leadRoleId && m.roles.cache.has(leadRoleId))
                            return;
                        if (owners.includes(m.id))
                            return;
                    }
                    if (!existing.has(m.id)) {
                        rows.push({ user_id: m.id, points: 0, reports_count: 0, shifts_count: 0 });
                        existing.add(m.id);
                    }
                });
            }
        }
        if (mainGuild) {
            const hierarchy: string[] = cfg.hierarchyOrder || [];
            const roleNameById: Record<string, string> = {};
            Object.entries(cfg.roles || {}).forEach(([name, id]) => roleNameById[id as string] = name);
            rows.forEach(r => {
                const member: GuildMember | undefined = mainGuild.members.cache.get(r.user_id);
                if (!member)
                    return;
                let found: string | undefined;
                for (let i = hierarchy.length - 1; i >= 0; i--) {
                    const rankName = hierarchy[i];
                    const roleId = (cfg.roles || {})[rankName];
                    if (roleId && member.roles.cache.has(roleId)) {
                        found = rankName;
                        break;
                    }
                }
                r.rankName = found;
            });
        }
    }
    catch (error) {
        console.error('Error processing area data:', error);
    }
    return rows.sort(sort);
}
function loadGoals(): {
    metas: Record<string, AreaGoals>;
    metasRankIndex: Record<string, Record<string, RankGoal>>;
} {
    let metas: Record<string, AreaGoals> = {};
    const metasRankIndex: Record<string, Record<string, RankGoal>> = {};
    const normalizeRank = (n?: string) => (n || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/º|°/g, '')
        .replace(/terceir[oa]/g, '3')
        .replace(/segund[oa]/g, '2')
        .replace(/primeir[oa]/g, '1')
        .replace(/\bcapitao\b/g, 'capitan')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    try {
        const metasPath = path.resolve('src/config/metas.json');
        const raw = readFileSync(metasPath, 'utf8');
        metas = JSON.parse(raw);
        Object.entries(metas).forEach(([areaKey, data]: [
            string,
            any
        ]) => {
            const idx: Record<string, RankGoal> = {};
            (data.ranks || []).forEach((rg: any) => {
                const base = normalizeRank(rg.name);
                idx[base] = rg;
                const wordVariant = base
                    .replace(/\b1\b/g, 'primeiro')
                    .replace(/\b2\b/g, 'segundo')
                    .replace(/\b3\b/g, 'terceiro');
                if (!idx[wordVariant])
                    idx[wordVariant] = rg;
            });
            metasRankIndex[areaKey.toLowerCase()] = idx;
        });
    }
    catch (error) {
        console.error('Error loading goals:', error);
    }
    return { metas, metasRankIndex };
}
function formatNumber(n: number): string {
    return n.toLocaleString('pt-BR');
}
function median(values: number[]): number {
    if (!values.length)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function getInitials(username: string): string {
    return username
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}
async function getRankColor(client: Client, userId: string, rankName?: string): Promise<string> {
    if (!rankName)
        return '#6b7280';
    try {
        const cfg: any = loadConfig();
        if (!cfg.mainGuildId)
            return '#6b7280';
        const mainGuild = client.guilds.cache.get(cfg.mainGuildId) || await client.guilds.fetch(cfg.mainGuildId).catch(() => null);
        if (!mainGuild)
            return '#6b7280';
        const member = mainGuild.members.cache.get(userId) || await mainGuild.members.fetch(userId).catch(() => null);
        if (!member)
            return '#6b7280';
        const hierarchyOrder: string[] = cfg.hierarchyOrder || [];
        const roles = cfg.roles || {};
        for (const hierarchyRank of hierarchyOrder) {
            const roleId = roles[hierarchyRank];
            if (roleId && member.roles.cache.has(roleId)) {
                const role = mainGuild.roles.cache.get(roleId);
                if (role && role.hexColor && role.hexColor !== '#000000') {
                    return role.hexColor;
                }
            }
        }
        const highestRole = member.roles.highest;
        if (highestRole && highestRole.hexColor && highestRole.hexColor !== '#000000') {
            return highestRole.hexColor;
        }
        return '#6b7280';
    }
    catch (error) {
        console.error('Error getting rank color:', error);
        return '#6b7280';
    }
}
async function fetchAvatarAsBase64(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok)
            return null;
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = response.headers.get('content-type') || 'image/png';
        return `data:${mimeType};base64,${base64}`;
    }
    catch (error) {
        console.error('Error fetching avatar:', error);
        return null;
    }
}
async function processParticipants(client: Client, rows: MemberRow[], area: string, totalPoints: number, maxPoints: number): Promise<ParticipantData[]> {
    const { metasRankIndex } = loadGoals();
    const areaKey = area.toLowerCase();
    const isSupport = areaKey === 'suporte';
    const SUPPORT_PLANTOES_META = 4;
    const areaRankGoals = metasRankIndex[areaKey] || {};
    const normalizeRank = (n?: string) => (n || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/º|°/g, '')
        .replace(/terceir[oa]/g, '3')
        .replace(/segund[oa]/g, '2')
        .replace(/primeir[oa]/g, '1')
        .replace(/\bcapitao\b/g, 'capitan')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const participants: ParticipantData[] = [];
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const user = await client.users.fetch(row.user_id).catch(() => null);
        const username = user ? user.username : row.user_id;
        const avatar = user ? await fetchAvatarAsBase64(user.displayAvatarURL({ size: 128, extension: 'png' } as any)) : null;
        const pctTotal = totalPoints ? (row.points / totalPoints * 100) : 0;
        const partPct = maxPoints ? (row.points / maxPoints) * 100 : 0;
        const rnNorm = normalizeRank(row.rankName);
        const g = areaRankGoals[rnNorm];
        let metGoals = true;
        let goalData: any = {};
        if (isSupport) {
            const pointGoal = g?.points ?? 170;
            const reportsGoal = g?.reports ?? 8;
            const hitPoints = row.points >= pointGoal;
            const hitReports = (row.reports_count || 0) >= reportsGoal;
            const hitShifts = (row.shifts_count || 0) >= SUPPORT_PLANTOES_META;
            metGoals = hitPoints && hitReports && hitShifts;
            goalData = {
                pointsGoal: pointGoal,
                pointsGoalMet: hitPoints,
                pointsIcon: hitPoints ? '✅' : '❌',
                pointsNeeded: Math.max(0, pointGoal - row.points),
                pointsText: `Meta Pontos: ${pointGoal}${hitPoints ? '' : ` (faltam ${Math.max(0, pointGoal - row.points)})`}`,
                reportsGoal: reportsGoal,
                reportsGoalMet: hitReports,
                reportsIcon: hitReports ? '✅' : '❌',
                reportsNeeded: Math.max(0, reportsGoal - (row.reports_count || 0)),
                reportsText: `Relatórios: ${row.reports_count || 0}/${reportsGoal}${hitReports ? '' : ` (faltam ${Math.max(0, reportsGoal - (row.reports_count || 0))})`}`,
                shiftsGoal: SUPPORT_PLANTOES_META,
                shiftsGoalMet: hitShifts,
                shiftsIcon: hitShifts ? '✅' : '❌',
                shiftsNeeded: Math.max(0, SUPPORT_PLANTOES_META - (row.shifts_count || 0)),
                shiftsText: `Plantões: ${row.shifts_count || 0}/${SUPPORT_PLANTOES_META}${hitShifts ? '' : ` (faltam ${Math.max(0, SUPPORT_PLANTOES_META - (row.shifts_count || 0))})`}`
            };
        }
        else if (g) {
            const threshold = g.upPoints ?? g.points ?? 0;
            const hitPoints = threshold > 0 ? row.points >= threshold : true;
            metGoals = hitPoints;
            goalData = {
                goal: threshold,
                goalMet: hitPoints,
                goalIcon: hitPoints ? '✅' : '❌',
                goalNeeded: Math.max(0, threshold - row.points),
                goalText: `Meta: ${threshold}${hitPoints ? '' : ` (faltam ${Math.max(0, threshold - row.points)})`}`
            };
        }
        const rankColor = await getRankColor(client, row.user_id, row.rankName);
        let hex = (rankColor || '#6b7280').replace('#', '');
        if (hex.length === 3) {
            hex = hex.split('').map(ch => ch + ch).join('');
        }
        const rCh = parseInt(hex.substring(0, 2), 16) || 0;
        const gCh = parseInt(hex.substring(2, 4), 16) || 0;
        const bCh = parseInt(hex.substring(4, 6), 16) || 0;
        const luminance = (0.2126 * rCh + 0.7152 * gCh + 0.0722 * bCh) / 255;
        const tooLight = luminance > 0.9;
        const rankTextColor = tooLight ? '#111111' : rankColor;
        const rankBorderColor = tooLight ? '#111111' : rankColor;
        const rankBg = tooLight ? '#f5f5f5' : 'transparent';
        const isTop1 = i === 0;
        const badgeText = isTop1 ? 'Staff Sensação' : (metGoals ? 'META CUMPRIDA' : 'META NÃO CUMPRIDA');
        participants.push({
            username,
            userId: row.user_id,
            points: row.points || 0,
            percentage: pctTotal.toFixed(1),
            totalPercentage: pctTotal.toFixed(2),
            reports: row.reports_count,
            shifts: row.shifts_count,
            avatar: avatar || undefined,
            initials: getInitials(username),
            rank: row.rankName,
            rankColor,
            rankTextColor,
            rankBorderColor,
            rankBg,
            metGoals,
            isSupport,
            isNonSupport: !isSupport,
            participation: !isSupport ? `${partPct.toFixed(0)}% do líder` : undefined,
            isTop1,
            badgeText,
            ...goalData
        });
    }
    return participants;
}
function renderTemplate(template: string, data: TemplateData): string {
    let result = template;
    result = renderLoops(result, data);
    result = renderConditionals(result, data);
    Object.entries(data).forEach(([key, value]) => {
        if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            const regex = new RegExp(`{{${key}}}`, 'g');
            result = result.replace(regex, String(value));
        }
    });
    result = cleanupTemplateRemnants(result);
    return result;
}
function renderLoops(template: string, data: TemplateData): string {
    let result = template;
    result = result.replace(/{{#each topParticipants}}([\s\S]*?){{\/each}}/g, (match, block) => {
        return data.topParticipants.map((participant, index) => {
            let itemBlock = block;
            let medalOrNumber: string;
            if (index === 0) {
                medalOrNumber = '🥇';
            }
            else if (index === 1) {
                medalOrNumber = '🥈';
            }
            else if (index === 2) {
                medalOrNumber = '🥉';
            }
            else {
                medalOrNumber = String(index + 1);
            }
            itemBlock = itemBlock.replace(/{{add @index 1}}/g, String(index + 1));
            itemBlock = itemBlock.replace(/{{medalOrNumber}}/g, medalOrNumber);
            itemBlock = itemBlock.replace(/{{#if @first}}([\s\S]*?){{\/if}}/g, index === 0 ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#if \(eq @index 1\)}}([\s\S]*?){{\/if}}/g, index === 1 ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#if \(eq @index 2\)}}([\s\S]*?){{\/if}}/g, index === 2 ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#if \(lte @index 2\)}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, index <= 2 ? '$1' : '$2');
            itemBlock = itemBlock.replace(/{{#if \(lte @index 2\)}}([\s\S]*?){{\/if}}/g, index <= 2 ? '$1' : '');
            Object.entries(participant).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                if (key === 'points') {
                    itemBlock = itemBlock.replace(regex, String(value ?? 0));
                }
                else {
                    itemBlock = itemBlock.replace(regex, String(value || ''));
                }
            });
            itemBlock = cleanupTemplateRemnants(itemBlock);
            return itemBlock;
        }).join('');
    });
    result = result.replace(/{{#each participants}}([\s\S]*?){{\/each}}/g, (match, block) => {
        return data.participants.map((participant, index) => {
            let itemBlock = block;
            itemBlock = itemBlock.replace(/{{add @index 1}}/g, String(index + 1));
            itemBlock = itemBlock.replace(/{{#if @first}}([\s\S]*?){{\/if}}/g, index === 0 ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#if \(lte @index 2\)}}([\s\S]*?){{\/if}}/g, index <= 2 ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#if avatar}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, participant.avatar ? '$1' : '$2');
            itemBlock = itemBlock.replace(/{{#if metGoals}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, participant.metGoals ? '$1' : '$2');
            itemBlock = itemBlock.replace(/{{#if rank}}([\s\S]*?){{\/if}}/g, participant.rank ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#if reportsGoal}}([\s\S]*?){{\/if}}/g, participant.reportsGoal ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#if goal}}([\s\S]*?){{\/if}}/g, participant.goal ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#if pointsGoalMet}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, participant.pointsGoalMet ? '$1' : '$2');
            itemBlock = itemBlock.replace(/{{#if reportsGoalMet}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, participant.reportsGoalMet ? '$1' : '$2');
            itemBlock = itemBlock.replace(/{{#if shiftsGoalMet}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, participant.shiftsGoalMet ? '$1' : '$2');
            itemBlock = itemBlock.replace(/{{#if goalMet}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, participant.goalMet ? '$1' : '$2');
            itemBlock = itemBlock.replace(/{{#unless pointsGoalMet}}([\s\S]*?){{\/unless}}/g, !participant.pointsGoalMet ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#unless reportsGoalMet}}([\s\S]*?){{\/unless}}/g, !participant.reportsGoalMet ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#unless shiftsGoalMet}}([\s\S]*?){{\/unless}}/g, !participant.shiftsGoalMet ? '$1' : '');
            itemBlock = itemBlock.replace(/{{#unless goalMet}}([\s\S]*?){{\/unless}}/g, !participant.goalMet ? '$1' : '');
            Object.entries(participant).forEach(([key, value]) => {
                const regex = new RegExp(`{{${key}}}`, 'g');
                if (key === 'points') {
                    itemBlock = itemBlock.replace(regex, String(value ?? 0));
                }
                else {
                    itemBlock = itemBlock.replace(regex, String(value || ''));
                }
            });
            itemBlock = cleanupTemplateRemnants(itemBlock);
            return itemBlock;
        }).join('');
    });
    return result;
}
function cleanupTemplateRemnants(template: string): string {
    let result = template;
    result = result.replace(/{{#if[^}]*}}/g, '');
    result = result.replace(/{{\/if}}/g, '');
    result = result.replace(/{{#unless[^}]*}}/g, '');
    result = result.replace(/{{\/unless}}/g, '');
    result = result.replace(/{{else}}/g, '');
    result = result.replace(/{{#each[^}]*}}/g, '');
    result = result.replace(/{{\/each}}/g, '');
    result = result.replace(/{{[^}]*}}/g, '');
    return result;
}
function renderConditionals(template: string, data: TemplateData): string {
    let result = template;
    result = result.replace(/{{#if isSupport}}([\s\S]*?){{else}}([\s\S]*?){{\/if}}/g, (match, ifBlock, elseBlock) => {
        return data.isSupport ? ifBlock : elseBlock;
    });
    result = result.replace(/{{#if isSupport}}([\s\S]*?){{\/if}}/g, (match, block) => {
        return data.isSupport ? block : '';
    });
    result = result.replace(/{{#if[^}]*}}/g, '');
    result = result.replace(/{{\/if}}/g, '');
    result = result.replace(/{{#unless[^}]*}}/g, '');
    result = result.replace(/{{\/unless}}/g, '');
    result = result.replace(/{{else}}/g, '');
    result = result.replace(/{{#each[^}]*}}/g, '');
    result = result.replace(/{{\/each}}/g, '');
    return result;
}
function normalizeAreaKey(input: string): string {
    const base = (input || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (base === 'mov call' || base === 'movcall') return 'movcall';
    if (base === 'design') return 'design';
    if (base === 'eventos' || base === 'evento') return 'eventos';
    if (base === 'suporte') return 'suporte';
    if (base === 'recrutamento') return 'recrutamento';
    if (base === 'jornalismo') return 'jornalismo';
    return base; // fallback
}

export async function generateAreaPdf(client: Client, area: string): Promise<Buffer> {
    let browser: Browser | null = null;
    try {
        const areaKey = normalizeAreaKey(area);
        const rows = await fetchAreaRows(client, areaKey);
        const theme = getAreaTheme(areaKey);
        if (!rows.length) {
            throw new Error('Nenhum participante encontrado para esta área');
        }
        const totalPoints = rows.reduce((s, r) => s + (r.points || 0), 0);
        const avgPoints = totalPoints / rows.length;
        const medPoints = median(rows.map(r => r.points));
        const maxPoints = rows[0].points || 1;
        const participants = await processParticipants(client, rows, areaKey, totalPoints, maxPoints);
        const topParticipants = participants;
        if (participants.length === 0) {
            const mockParticipants = [
                {
                    username: 'TestUser1',
                    userId: '123456789',
                    points: 100,
                    percentage: '50.0',
                    totalPercentage: '50.00',
                    reports: 5,
                    shifts: 3,
                    participation: '100% do líder',
                    initials: 'TU',
                    metGoals: true,
                    pointsGoal: 80,
                    pointsGoalMet: true,
                    reportsGoal: 4,
                    reportsGoalMet: true,
                    shiftsGoal: 4,
                    shiftsGoalMet: false,
                    shiftsNeeded: 1
                }
            ];
            participants.push(...mockParticipants);
            topParticipants.push(...mockParticipants);
        }
        let version = 'unknown';
        try {
            const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
            version = pkg.version || version;
        }
        catch { }
        const templatePath = path.resolve('src/pdf-playwright/templates/monochrome.html');
        const stylePath = path.resolve('src/pdf-playwright/styles/monochrome.css');
        if (!existsSync(templatePath) || !existsSync(stylePath)) {
            throw new Error('Template ou arquivo de estilo não encontrado');
        }
        const template = readFileSync(templatePath, 'utf8');
        const styles = readFileSync(stylePath, 'utf8');
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const templateData: TemplateData = {
            title: `Relatório de Pontos - ${theme.name}`,
            styles,
            theme: theme.cssClass,
            icon: theme.icon,
            areaName: theme.name,
            date: `${dateStr} às ${now.toLocaleTimeString('pt-BR')}`,
            version,
            totalParticipants: formatNumber(rows.length),
            totalPoints: formatNumber(totalPoints),
            avgPoints: formatNumber(Math.round(avgPoints)),
            medianPoints: formatNumber(Math.round(medPoints)),
            maxPoints: formatNumber(maxPoints),
            isSupport: areaKey === 'suporte',
            topParticipants,
            participants,
            pageNumber: 1
        };
        const html = renderTemplate(template, templateData);
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            margin: {
                top: '20mm',
                right: '15mm',
                bottom: '20mm',
                left: '15mm'
            },
            printBackground: true,
            preferCSSPageSize: true
        });
        return Buffer.from(pdfBuffer);
    }
    catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
}
