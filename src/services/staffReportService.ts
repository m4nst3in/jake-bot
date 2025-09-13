import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, User } from 'discord.js';
import { PointRepository } from '../repositories/pointRepository.ts';
import { BlacklistRepository } from '../repositories/blacklistRepository.ts';
import { OccurrenceRepository } from '../repositories/occurrenceRepository.ts';
import { RPPRepository } from '../repositories/rppRepository.ts';
import { PointsService } from './pointsService.ts';
import { loadConfig } from '../config/index.ts';
import { logger } from '../utils/logger.ts';
interface WeeklyStats {
    week: number;
    startDate: Date;
    endDate: Date;
    points: number;
    reports: number;
    shifts: number;
}
interface UserAreaInfo {
    area: string;
    points: number;
    reports: number;
    shifts: number;
    position: number | null;
    isLeader: boolean;
    isMember: boolean;
}
interface StaffJoinInfo {
    joinedAt: Date | null;
    daysAsStaff: number;
}
interface UserGoals {
    area: string;
    currentRank: string | null;
    nextRank: string | null;
    progress: {
        points: {
            current: number;
            required: number;
            percentage: number;
        };
        reports: {
            current: number;
            required: number;
            percentage: number;
        } | null;
        shifts: {
            current: number;
            required: number;
            percentage: number;
        } | null;
    };
    timeframe: string;
}
export class StaffReportService {
    private pointRepo: PointRepository;
    private blacklistRepo: BlacklistRepository;
    private occRepo: OccurrenceRepository;
    private rppRepo: RPPRepository;
    private pointsService: PointsService;
    constructor() {
        this.pointRepo = new PointRepository();
        this.blacklistRepo = new BlacklistRepository();
        this.occRepo = new OccurrenceRepository();
        this.rppRepo = new RPPRepository();
        this.pointsService = new PointsService();
    }
    async generateSummaryEmbed(userId: string, target: User): Promise<EmbedBuilder> {
        const [userAreas, dailyPoints, totalOccs, activeRpp, actualRank] = await Promise.all([
            this.getUserAreaInfo(userId),
            this.getDailyPointsThisWeek(userId),
            this.occRepo.countForUser(userId).catch(() => 0),
            this.rppRepo.findActiveByUser(userId).catch(() => null),
            this.getUserActualRank(userId)
        ]);
        const cfg: any = loadConfig();
        const totalPoints = userAreas.reduce((sum, area) => sum + area.points, 0);
        const totalReports = userAreas.reduce((sum, area) => sum + area.reports, 0);
        const totalShifts = userAreas.reduce((sum, area) => sum + area.shifts, 0);
        const areaLines: string[] = [];
        if (userAreas.length > 0) {
            for (const area of userAreas) {
                const leaderIcon = area.isLeader ? '<a:black_coroa:1121284795180269617>' : '';
                const posText = area.position && area.points > 0 ? `#${area.position}` : '-';
                const extras: string[] = [];
                if (area.reports > 0)
                    extras.push(`🧾 ${area.reports}`);
                if (area.shifts > 0)
                    extras.push(`🕒 ${area.shifts}`);
                const extraText = extras.length > 0 ? ` • ${extras.join(' • ')}` : '';
                areaLines.push(`${leaderIcon} **${area.area}** ${posText} — **${area.points}** pts${extraText}`);
            }
        }
        else {
            areaLines.push('*Nenhuma área encontrada*');
        }
        const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const dailyText = weekDays.map((day, i) => {
            const points = dailyPoints[i] || 0;
            const emoji = points > 0 ? '🟢' : '⚪';
            return `${emoji} ${day}: ${points}`;
        }).join('\n');
        const statusBadges: string[] = [];
        if (totalOccs > 0)
            statusBadges.push(`📂 ${totalOccs} ocorrência(s)`);
        if (activeRpp)
            statusBadges.push('🧪 RPP Ativo');
        // Detect primary progression area (where the user 'upa') by checking progressionRoles per area guild
        let upaArea: string | null = null;
        try {
            const prog: any = (cfg as any).progressionRoles || {};
            const discordClient: any = (globalThis as any).client;
            if (discordClient) {
                for (const a of (cfg.areas || [])) {
                    const gId = a.guildId;
                    const upaRoles: string[] = prog[gId]?.upa || [];
                    if (!gId || !upaRoles?.length) continue;
                    const guildObj = discordClient.guilds.cache.get(gId) || await discordClient.guilds.fetch(gId).catch(() => null);
                    if (!guildObj) continue;
                    const memberObj = await guildObj.members.fetch(userId).catch(() => null);
                    if (memberObj && upaRoles.some((rid: string) => memberObj.roles.cache.has(rid))) {
                        upaArea = a.name;
                        break;
                    }
                }
            }
        } catch {}
        const sections = [
            '**<a:Cronwnss:1355323942705041600> Áreas de Atuação**',
            areaLines.join('\n')
        ];
        if (upaArea) {
            sections.splice(1, 0, `<a:vSETAverdeclaro:1386504186396676141> Upa por: **${upaArea}**`);
        }
        if (actualRank) {
            sections.push('', `**<a:vSETAverdeclaro:1386504186396676141> Cargo Atual:** ${actualRank}`);
        }
        sections.push('', '**<a:vSETAverdeclaro:1386504186396676141> Pontos Esta Semana**', dailyText);
        if (statusBadges.length > 0) {
            sections.push('', '**<a:vSETAverdeclaro:1386504186396676141> Status**', statusBadges.join(' • '));
        }
        const embed = new EmbedBuilder()
            .setTitle(`<a:green_hypecuty_cdw:1415591722200731688> Relatório de Staff • ${target.username}`)
            .setDescription(sections.join('\n'))
            .setColor(0x3498DB)
            .setFooter({
            text: `Total: ${totalPoints} pts • ${totalReports} rel. • ${totalShifts} plant. • ID: ${userId}`
        })
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp();
        return embed;
    }
    async generateHistoryEmbed(userId: string, target: User): Promise<EmbedBuilder> {
        const [weeklyStats, staffJoinInfo, blacklistHistory, occCount] = await Promise.all([
            this.getWeeklyStats(userId, 5),
            this.getStaffJoinInfo(userId),
            this.blacklistRepo.listUserActive(userId).catch(() => []),
            this.occRepo.countForUser(userId).catch(() => 0)
        ]);
        const weekLines: string[] = [];
        if (weeklyStats.length > 0) {
            weeklyStats.forEach((week, index) => {
                const weekAgo = index === 0 ? 'Esta semana' : `${index + 1}ª semana atrás`;
                const extras: string[] = [];
                if (week.reports > 0)
                    extras.push(`<a:vSETAverdeclaro:1386504186396676141> ${week.reports}`);
                if (week.shifts > 0)
                    extras.push(`<a:vSETAverdeclaro:1386504186396676141> ${week.shifts}`);
                const extraText = extras.length > 0 ? ` • ${extras.join(' • ')}` : '';
                weekLines.push(`<a:vSETAverdeclaro:1386504186396676141> **${weekAgo}**: ${week.points} pts${extraText}`);
            });
        }
        else {
            weekLines.push('*Nenhum histórico encontrado*');
        }
        const joinText = staffJoinInfo.joinedAt
            ? `<a:vSETAverdeclaro:1386504186396676141> **Staff desde**: ${staffJoinInfo.joinedAt.toLocaleDateString('pt-BR')} (${staffJoinInfo.daysAsStaff} dias)`
            : '<a:vSETAverdeclaro:1386504186396676141> **Staff desde**: *Não identificado*';
        const issuesLines: string[] = [];
        if (blacklistHistory.length > 0) {
            const blacklistText = blacklistHistory
                .slice(0, 3)
                .map((b: any) => `• ${b.area_or_global || 'GLOBAL'}: ${b.reason || 'Sem motivo'}`)
                .join('\n');
            issuesLines.push('<:d_coroavermelha:1283521261426835466> **Blacklist Ativa**', blacklistText);
            if (blacklistHistory.length > 3) {
                issuesLines.push(`*... e mais ${blacklistHistory.length - 3}*`);
            }
        }
        if (occCount > 0) {
            issuesLines.push('<:d_coroavermelha:1283521261426835466> **Ocorrências**: ' + occCount);
        }
        if (issuesLines.length === 0) {
            issuesLines.push('<:ponto_branco:1194039643545538561> **Sem restrições ativas**');
        }
        const sections = [
            '**<:white_rules:1414413082800820284> Histórico das Últimas 5 Semanas**',
            weekLines.join('\n'),
            '',
            joinText,
            '',
            '**<a:emoji_45:1316060213312487465> Situação Disciplinar**',
            issuesLines.join('\n')
        ];
        const embed = new EmbedBuilder()
            .setTitle(`<:crown2:1411488673924644944> Histórico • ${target.username}`)
            .setDescription(sections.join('\n'))
            .setColor(0x9B59B6)
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp();
        return embed;
    }
    async generateGoalsEmbed(userId: string, target: User): Promise<EmbedBuilder> {
        const [userAreas, userGoals] = await Promise.all([
            this.getUserAreaInfo(userId),
            this.getUserGoals(userId)
        ]);
        if (userGoals.length === 0) {
            return new EmbedBuilder()
                .setTitle(`<a:green_hypecuty_cdw:1415591722200731688> Metas • ${target.username}`)
                .setDescription('*Nenhuma meta encontrada para este usuário*')
                .setColor(0xF39C12)
                .setThumbnail(target.displayAvatarURL())
                .setTimestamp();
        }
        const goalSections: string[] = [];
        for (const goal of userGoals) {
            const area = userAreas.find(a => a.area.toLowerCase() === goal.area.toLowerCase());
            const leaderIcon = area?.isLeader ? '👑 ' : '';
            goalSections.push(`${leaderIcon}**${goal.area}**`);
            if (goal.currentRank) {
                goalSections.push(`<a:vSETAverdeclaro:1386504186396676141> Cargo atual: **${goal.currentRank}**`);
            }
            if (goal.nextRank) {
                goalSections.push(`<a:vSETAverdeclaro:1386504186396676141> Próximo cargo: **${goal.nextRank}**`);
                goalSections.push(`<a:vSETAverdeclaro:1386504186396676141> Período: ${goal.timeframe}`);
                goalSections.push('');
                const pointsProgress = this.generateProgressBar(goal.progress.points.percentage);
                goalSections.push(`<a:vSETAverdeclaro:1386504186396676141> **Pontos**: ${goal.progress.points.current}/${goal.progress.points.required} ${pointsProgress}`);
                if (goal.progress.reports) {
                    const reportsProgress = this.generateProgressBar(goal.progress.reports.percentage);
                    goalSections.push(`<a:vSETAverdeclaro:1386504186396676141> **Relatórios**: ${goal.progress.reports.current}/${goal.progress.reports.required} ${reportsProgress}`);
                }
                if (goal.progress.shifts) {
                    const shiftsProgress = this.generateProgressBar(goal.progress.shifts.percentage);
                    goalSections.push(`<a:vSETAverdeclaro:1386504186396676141> **Plantões**: ${goal.progress.shifts.current}/${goal.progress.shifts.required} ${shiftsProgress}`);
                }
            }
            else {
                goalSections.push('<a:green_star02:1180891460875325560> **Cargo máximo atingido**');
            }
            goalSections.push('');
        }
        const embed = new EmbedBuilder()
            .setTitle(`<a:green_hypecuty_cdw:1415591722200731688> Metas e Objetivos • ${target.username}`)
            .setDescription(goalSections.join('\n'))
            .setColor(0xF39C12)
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp();
        return embed;
    }
    generateNavigationButtons(userId: string, currentView: 'summary' | 'history' | 'goals'): ActionRowBuilder<ButtonBuilder> {
        const summaryBtn = new ButtonBuilder()
            .setCustomId(`staff_report_summary_${userId}`)
            .setLabel('📊 Resumo')
            .setStyle(currentView === 'summary' ? ButtonStyle.Primary : ButtonStyle.Secondary);
        const historyBtn = new ButtonBuilder()
            .setCustomId(`staff_report_history_${userId}`)
            .setLabel('📜 Histórico')
            .setStyle(currentView === 'history' ? ButtonStyle.Primary : ButtonStyle.Secondary);
        const goalsBtn = new ButtonBuilder()
            .setCustomId(`staff_report_goals_${userId}`)
            .setLabel('🎯 Metas')
            .setStyle(currentView === 'goals' ? ButtonStyle.Primary : ButtonStyle.Secondary);
        return new ActionRowBuilder<ButtonBuilder>().addComponents(summaryBtn, historyBtn, goalsBtn);
    }
    private async getUserAreaInfo(userId: string): Promise<UserAreaInfo[]> {
        const profile = await this.pointsService.getUserProfile(userId);
        const cfg: any = loadConfig();
        const areas: UserAreaInfo[] = [];
        const positions = await Promise.all(profile.areas.map(a => (this.pointRepo as any).getAreaPosition(userId, a.area).catch(() => null)));
        for (let i = 0; i < profile.areas.length; i++) {
            const area = profile.areas[i];
            areas.push({
                area: area.area,
                points: area.points || 0,
                reports: area.reports || 0,
                shifts: area.shifts || 0,
                position: positions[i],
                isLeader: false,
                isMember: true
            });
        }
        try {
            const cfgAreas: any[] = cfg.areas || [];
            const client = (globalThis as any).client;
            if (client) {
                for (const cfgArea of cfgAreas) {
                    if (!cfgArea.guildId)
                        continue;
                    try {
                        const guild = client.guilds.cache.get(cfgArea.guildId) || await client.guilds.fetch(cfgArea.guildId);
                        const member = await guild.members.fetch(userId).catch(() => null);
                        if (member) {
                            const areaInfo = areas.find(a => a.area.toLowerCase() === cfgArea.name.toLowerCase());
                            if (cfgArea.roleIds?.lead && member.roles.cache.has(cfgArea.roleIds.lead)) {
                                if (areaInfo) {
                                    areaInfo.isLeader = true;
                                }
                            }
                            if (cfgArea.roleIds?.member && member.roles.cache.has(cfgArea.roleIds.member)) {
                                if (!areaInfo) {
                                    areas.push({
                                        area: cfgArea.name,
                                        points: 0,
                                        reports: 0,
                                        shifts: 0,
                                        position: null,
                                        isLeader: false,
                                        isMember: true
                                    });
                                }
                            }
                        }
                    }
                    catch (error) {
                        logger.warn({ error, userId, area: cfgArea.name }, 'Erro ao verificar membership/liderança');
                    }
                }
            }
        }
        catch (error) {
            logger.error({ error, userId }, 'Erro geral ao obter info de áreas');
        }
        return areas.sort((a, b) => (b.points - a.points) || a.area.localeCompare(b.area));
    }
    private async getDailyPointsThisWeek(userId: string): Promise<number[]> {
        try {
            return await (this.pointRepo as any).getDailyPointsThisWeek(userId);
        }
        catch (error) {
            logger.error({ error, userId }, 'Erro ao obter pontos diários');
            return new Array(7).fill(0);
        }
    }
    private async getWeeklyStats(userId: string, weeks: number): Promise<WeeklyStats[]> {
        try {
            const stats = await (this.pointRepo as any).getWeeklyStats(userId, weeks);
            return stats.map((s: any) => ({
                week: s.week,
                startDate: s.startDate,
                endDate: s.endDate,
                points: s.points,
                reports: s.reports,
                shifts: s.shifts
            }));
        }
        catch (error) {
            logger.error({ error, userId, weeks }, 'Erro ao obter stats semanais');
            return [];
        }
    }
    private async getStaffJoinInfo(userId: string): Promise<StaffJoinInfo> {
        try {
            let joinedAt: Date | null = null;
            if ((this.pointRepo as any).isSqlite()) {
                const firstLog = await new Promise<any>((resolve, reject) => {
                    (this.pointRepo as any).sqlite.get('SELECT timestamp FROM point_logs WHERE user_id = ? ORDER BY timestamp ASC LIMIT 1', [userId], (err: Error | null, row: any) => {
                        if (err)
                            reject(err);
                        else
                            resolve(row);
                    });
                });
                if (firstLog && firstLog.timestamp) {
                    joinedAt = new Date(firstLog.timestamp);
                }
            }
            else {
                const firstLog = await (this.pointRepo as any).mongo.collection('point_logs')
                    .findOne({ user_id: userId }, { sort: { timestamp: 1 } });
                if (firstLog && firstLog.timestamp) {
                    joinedAt = new Date(firstLog.timestamp);
                }
            }
            const daysAsStaff = joinedAt ? Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24)) : 0;
            return {
                joinedAt,
                daysAsStaff
            };
        }
        catch (error) {
            logger.error({ error, userId }, 'Erro ao obter info de entrada no staff');
            return {
                joinedAt: null,
                daysAsStaff: 0
            };
        }
    }
    private async getUserGoals(userId: string): Promise<UserGoals[]> {
        try {
            const userAreas = await this.getUserAreaInfo(userId);
            const goals: UserGoals[] = [];
            const primaryArea = await this.getUserPrimaryArea(userId, userAreas);
            if (!primaryArea)
                return [];
            const metasConfig = await import('../config/metas.json', { with: { type: 'json' } });
            const metas = metasConfig.default;
            const area = primaryArea;
            const areaKey = area.area.toLowerCase();
            const areaMetas = (metas as any)[areaKey];
            if (areaMetas && areaMetas.ranks) {
                const actualRank = await this.getUserActualRank(userId);
                let currentRankIndex = -1;
                let currentRank: string | null = actualRank;
                if (actualRank) {
                    currentRankIndex = areaMetas.ranks.findIndex((rank: any) => rank.name === actualRank);
                }
                if (currentRankIndex === -1) {
                    for (let i = areaMetas.ranks.length - 1; i >= 0; i--) {
                        const rank = areaMetas.ranks[i];
                        const requiredPoints = rank.upPoints || rank.points || 0;
                        if (area.points >= requiredPoints) {
                            currentRankIndex = i;
                            currentRank = rank.name;
                            break;
                        }
                    }
                }
                let nextRank: string | null = null;
                let progress: UserGoals['progress'] = {
                    points: { current: area.points, required: 0, percentage: 100 },
                    reports: null,
                    shifts: null
                };
                if (currentRankIndex < areaMetas.ranks.length - 1) {
                    const nextRankData = areaMetas.ranks[currentRankIndex + 1];
                    nextRank = nextRankData.name;
                    const requiredPoints = nextRankData.upPoints || nextRankData.points || 0;
                    const requiredReports = nextRankData.reports || null;
                    const requiredShifts = nextRankData.shifts || null;
                    progress.points = {
                        current: area.points,
                        required: requiredPoints,
                        percentage: requiredPoints > 0 ? Math.min((area.points / requiredPoints) * 100, 100) : 100
                    };
                    if (requiredReports !== null) {
                        progress.reports = {
                            current: area.reports,
                            required: requiredReports,
                            percentage: Math.min((area.reports / requiredReports) * 100, 100)
                        };
                    }
                    if (requiredShifts !== null) {
                        progress.shifts = {
                            current: area.shifts,
                            required: requiredShifts,
                            percentage: Math.min((area.shifts / requiredShifts) * 100, 100)
                        };
                    }
                }
                const timeframe = areaMetas.ranks[currentRankIndex + 1]?.period === '1w' ? 'Semanal' :
                    areaMetas.ranks[currentRankIndex + 1]?.period === '1m' ? 'Mensal' :
                        'Por mérito';
                goals.push({
                    area: area.area,
                    currentRank,
                    nextRank,
                    progress,
                    timeframe
                });
            }
            return goals;
        }
        catch (error) {
            logger.error({ error, userId }, 'Erro ao obter metas do usuário');
            return [];
        }
    }
    private async getUserPrimaryArea(userId: string, userAreas: UserAreaInfo[]): Promise<UserAreaInfo | null> {
        try {
            const cfg: any = loadConfig();
            const client = (globalThis as any).client;
            if (!client || !cfg.mainGuildId) {
                return userAreas.length > 0 ? userAreas.reduce((max, area) => area.points > max.points ? area : max) : null;
            }
            const mainGuild = client.guilds.cache.get(cfg.mainGuildId) || await client.guilds.fetch(cfg.mainGuildId);
            const member = await mainGuild.members.fetch(userId).catch(() => null);
            if (!member) {
                return userAreas.length > 0 ? userAreas.reduce((max, area) => area.points > max.points ? area : max) : null;
            }
            const membershipToLeadership = cfg.rppExtras?.membershipToLeadership || {};
            const leadershipRoles = Object.values(membershipToLeadership);
            for (const roleId of member.roles.cache.keys()) {
                if (leadershipRoles.includes(roleId)) {
                    const memberRoleId = Object.keys(membershipToLeadership).find(memberRole => membershipToLeadership[memberRole] === roleId);
                    if (memberRoleId && cfg.areas) {
                        const matchingCfgArea = cfg.areas.find((area: any) => area.roleIds?.member === memberRoleId);
                        if (matchingCfgArea) {
                            const matchingUserArea = userAreas.find(a => a.area.toLowerCase() === matchingCfgArea.name.toLowerCase());
                            if (matchingUserArea) {
                                return matchingUserArea;
                            }
                        }
                    }
                }
            }
            if (cfg.areas) {
                for (const cfgArea of cfg.areas) {
                    if (cfgArea.roleIds?.member && member.roles.cache.has(cfgArea.roleIds.member)) {
                        const matchingUserArea = userAreas.find(a => a.area.toLowerCase() === cfgArea.name.toLowerCase());
                        if (matchingUserArea) {
                            return matchingUserArea;
                        }
                    }
                }
            }
            const hierarchyOrder: string[] = cfg.hierarchyOrder || [];
            const roles: Record<string, string> = cfg.roles || {};
            for (const rankName of hierarchyOrder) {
                const roleId = roles[rankName];
                if (roleId && member.roles.cache.has(roleId)) {
                    return userAreas.length > 0 ? userAreas.reduce((max, area) => area.points > max.points ? area : max) : null;
                }
            }
            return userAreas.length > 0 ? userAreas.reduce((max, area) => area.points > max.points ? area : max) : null;
        }
        catch (error) {
            logger.error({ error, userId }, 'Erro ao determinar área principal');
            return userAreas.length > 0 ? userAreas[0] : null;
        }
    }
    private async getUserActualRank(userId: string): Promise<string | null> {
        try {
            const cfg: any = loadConfig();
            const client = (globalThis as any).client;
            if (!client || !cfg.mainGuildId)
                return null;
            const mainGuild = client.guilds.cache.get(cfg.mainGuildId) || await client.guilds.fetch(cfg.mainGuildId);
            const member = await mainGuild.members.fetch(userId).catch(() => null);
            if (!member)
                return null;
            const hierarchyOrder: string[] = cfg.hierarchyOrder || [];
            const roles: Record<string, string> = cfg.roles || {};
            for (let i = hierarchyOrder.length - 1; i >= 0; i--) {
                const rankName = hierarchyOrder[i];
                const roleId = roles[rankName];
                if (roleId && member.roles.cache.has(roleId)) {
                    return rankName;
                }
            }
            return null;
        }
        catch (error) {
            logger.warn({ error, userId }, 'Erro ao obter cargo real do usuário');
            return null;
        }
    }
    private generateProgressBar(percentage: number): string {
        const filled = Math.floor(percentage / 10);
        const empty = 10 - filled;
        let bar = '`[';
        bar += '█'.repeat(filled);
        bar += '░'.repeat(empty);
        bar += `]` + '`';
        const percentText = `${Math.round(percentage)}%`;
        return `${bar} ${percentText}`;
    }
}
