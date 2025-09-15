import { EmbedBuilder, Client, Guild, GuildMember, TextChannel, NewsChannel } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { loadConfig } from '../config/index.ts';
import { PointRepository } from '../repositories/pointRepository.ts';
import { UserRepository } from '../repositories/userRepository.ts';
import { BlacklistRepository } from '../repositories/blacklistRepository.ts';
import { RPPRepository } from '../repositories/rppRepository.ts';
import { DatabaseManager } from '../db/manager.ts';
interface ReboqueResult {
    success: boolean;
    error?: string;
    rolesRemoved: number;
    backupsSent: number;
    logSent: boolean;
}
interface UserBackupData {
    userId: string;
    username: string;
    points: any[];
    areas: string[];
    totalPoints: number;
    reboqueDate: string;
    executor: string;
    reason: string;
}
export class ReboqueService {
    private client: Client;
    private pointRepo: PointRepository;
    private userRepo: UserRepository;
    private blacklistRepo: BlacklistRepository;
    private rppRepo: RPPRepository;
    constructor() {
        this.client = (globalThis as any).client;
        this.pointRepo = new PointRepository();
        this.userRepo = new UserRepository();
        this.blacklistRepo = new BlacklistRepository();
        this.rppRepo = new RPPRepository();
    }
    async executeReboque(targetId: string, executorId: string, reason: string): Promise<ReboqueResult> {
        try {
            const cfg: any = loadConfig();
            const backupData = await this.getUserBackupData(targetId, executorId, reason);
            const userInfo = await this.getUserInfo(targetId);
            const rolesRemoved = await this.removeStaffRoles(targetId, cfg);
            const backupsSent = await this.sendBackupsToAreaChannels(backupData, cfg);
            await this.removeFromDatabase(targetId);
            const logSent = await this.sendReboqueLog(targetId, executorId, reason, userInfo, backupData, rolesRemoved, cfg);
            return {
                success: true,
                rolesRemoved,
                backupsSent,
                logSent
            };
        }
        catch (error) {
            logger.error({ error, targetId, executorId }, 'Erro ao executar reboque');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Erro desconhecido',
                rolesRemoved: 0,
                backupsSent: 0,
                logSent: false
            };
        }
    }
    private async getUserBackupData(targetId: string, executorId: string, reason: string): Promise<UserBackupData> {
        try {
            let pointsByArea = await this.pointRepo.getUserAllAreas(targetId);
            const cfg: any = loadConfig();
            const activeAreasByRole = new Set<string>();
            try {
                const areas = (cfg.areas || []) as Array<{
                    name: string;
                    guildId: string;
                    roleIds?: {
                        lead?: string;
                        member?: string;
                    };
                }>;
                for (const area of areas) {
                    if (!area?.guildId)
                        continue;
                    const g: Guild | null = this.client.guilds.cache.get(area.guildId) || await this.client.guilds.fetch(area.guildId).catch(() => null);
                    if (!g)
                        continue;
                    const mem: GuildMember | null = await g.members.fetch(targetId).catch(() => null);
                    if (!mem)
                        continue;
                    const leadId = area.roleIds?.lead;
                    const memberId = area.roleIds?.member;
                    if ((leadId && mem.roles.cache.has(leadId)) || (memberId && mem.roles.cache.has(memberId))) {
                        activeAreasByRole.add((area.name || '').toUpperCase());
                    }
                }
            }
            catch { }
            if (activeAreasByRole.size > 0) {
                pointsByArea = pointsByArea.filter((p: any) => activeAreasByRole.has(String(p.area || '').toUpperCase()));
            }
            const totalPoints = pointsByArea.reduce((sum, area) => sum + (area.points || 0), 0);
            const userInfo = await this.getUserInfo(targetId);
            return {
                userId: targetId,
                username: userInfo?.username || 'Usuário desconhecido',
                points: pointsByArea,
                areas: pointsByArea.map((p: any) => p.area),
                totalPoints,
                reboqueDate: new Date().toISOString(),
                executor: executorId,
                reason
            };
        }
        catch (error) {
            logger.error({ error, targetId }, 'Erro ao obter dados de backup');
            return {
                userId: targetId,
                username: 'Erro ao obter dados',
                points: [],
                areas: [],
                totalPoints: 0,
                reboqueDate: new Date().toISOString(),
                executor: executorId,
                reason
            };
        }
    }
    private async getUserInfo(targetId: string): Promise<{
        username: string;
        displayName: string;
        avatarURL: string | null;
    } | null> {
        try {
            const user = await this.client.users.fetch(targetId).catch(() => null);
            if (!user)
                return null;
            return {
                username: user.username,
                displayName: user.displayName || user.username,
                avatarURL: user.displayAvatarURL()
            };
        }
        catch (error) {
            logger.warn({ error, targetId }, 'Erro ao obter informações do usuário');
            return null;
        }
    }
    private async removeStaffRoles(targetId: string, cfg: any): Promise<number> {
        let totalRolesRemoved = 0;
        try {
            // Build a robust set of guilds to scan: configured ones + all guilds the bot is in
            const guildIdSet: Set<string> = new Set();
            if (cfg.mainGuildId) guildIdSet.add(cfg.mainGuildId);
            if (cfg.areas && Array.isArray(cfg.areas)) {
                for (const area of cfg.areas) if (area?.guildId) guildIdSet.add(area.guildId);
            }
            for (const g of this.client.guilds.cache.values()) guildIdSet.add(g.id);
            for (const guildId of guildIdSet) {
                if (!guildId)
                    continue;
                try {
                    const guild = this.client.guilds.cache.get(guildId) || await this.client.guilds.fetch(guildId);
                    const member = await guild.members.fetch(targetId).catch(() => null);
                    if (!member)
                        continue;
                    const staffRoles = this.getStaffRolesToRemove(member, cfg, guildId);
                    for (const roleId of staffRoles) {
                        try {
                            await member.roles.remove(roleId, `Reboque executado - Motivo: ${cfg.reason || 'Não especificado'}`);
                            totalRolesRemoved++;
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                        catch (error) {
                            logger.warn({ error, targetId, roleId, guildId }, 'Erro ao remover cargo específico');
                        }
                    }
                }
                catch (error) {
                    logger.warn({ error, targetId, guildId }, 'Erro ao processar servidor no reboque');
                }
            }
        }
        catch (error) {
            logger.error({ error, targetId }, 'Erro ao remover cargos de staff');
        }
        return totalRolesRemoved;
    }
    private getStaffRolesToRemove(member: GuildMember, cfg: any, guildId: string): string[] {
        const rolesToRemove: Set<string> = new Set();
        // Always remove global hierarchy roles if present
        if (cfg.roles) {
            for (const roleId of Object.values(cfg.roles)) {
                if (roleId && member.roles.cache.has(roleId as string)) rolesToRemove.add(roleId as string);
            }
        }
        // Area leadership mappings (main guild) and general leadership
        if (cfg.protection?.areaLeaderRoles) {
            for (const roleId of Object.values(cfg.protection.areaLeaderRoles)) {
                if (roleId && member.roles.cache.has(roleId as string)) rolesToRemove.add(roleId as string);
            }
        }
        if (cfg.protectionRoles?.leaderGeneral && member.roles.cache.has(cfg.protectionRoles.leaderGeneral)) {
            rolesToRemove.add(cfg.protectionRoles.leaderGeneral);
        }
        // Primary guild team/leadership roles (e.g., recrutamento, suporte, mov call)
        if (cfg.primaryGuildTeamRoles) {
            for (const roleId of Object.values(cfg.primaryGuildTeamRoles)) {
                if (roleId && member.roles.cache.has(roleId as string)) rolesToRemove.add(roleId as string);
            }
        }
        if (cfg.primaryGuildLeadershipRoles) {
            for (const roleId of Object.values(cfg.primaryGuildLeadershipRoles)) {
                if (roleId && member.roles.cache.has(roleId as string)) rolesToRemove.add(roleId as string);
            }
        }
        // Permission roles (global bot permissions)
        if (Array.isArray(cfg.permissionRoles)) {
            for (const roleId of cfg.permissionRoles) {
                if (roleId && member.roles.cache.has(roleId)) rolesToRemove.add(roleId);
            }
        }
        // Command-specific allowed roles
        const permCfg = cfg.permissions || {};
        const collectRoleArray = (arr?: string[]) => (Array.isArray(arr) ? arr : []);
        for (const rid of collectRoleArray(permCfg.recruit?.allowedRoles)) {
            if (rid && member.roles.cache.has(rid)) rolesToRemove.add(rid);
        }
        for (const rid of collectRoleArray(permCfg.transfer?.allowedRoles)) {
            if (rid && member.roles.cache.has(rid)) rolesToRemove.add(rid);
        }
        // points.extraManagers: flatten values
        const extraManagers: Record<string, string[] | undefined> = (permCfg.points?.extraManagers) || {};
        for (const arr of Object.values(extraManagers)) {
            for (const rid of collectRoleArray(arr)) {
                if (rid && member.roles.cache.has(rid)) rolesToRemove.add(rid);
            }
        }
        // VIP roles (optional)
        if (cfg.vipRoles) {
            for (const roleId of Object.values(cfg.vipRoles)) {
                if (roleId && member.roles.cache.has(roleId as string)) rolesToRemove.add(roleId as string);
            }
        }
        // Area-local roles (per area guild)
        const area = cfg.areas?.find((a: any) => a.guildId === guildId);
        if (area && area.roleIds) {
            if (area.roleIds.lead && member.roles.cache.has(area.roleIds.lead)) rolesToRemove.add(area.roleIds.lead);
            if (area.roleIds.member && member.roles.cache.has(area.roleIds.member)) rolesToRemove.add(area.roleIds.member);
        }
        return [...rolesToRemove];
    }
    private async sendBackupsToAreaChannels(backupData: UserBackupData, cfg: any): Promise<number> {
        let backupsSent = 0;
        try {
            logger.info({ userId: backupData.userId, areas: backupData.areas }, 'Dados de backup preparados (envio para canais desabilitado)');
        }
        catch (error) {
            logger.error({ error, userId: backupData.userId }, 'Erro ao processar backups');
        }
        return backupsSent;
    }
    private createBackupEmbed(backupData: UserBackupData, area: string): EmbedBuilder {
        const areaPoints = backupData.points.find((p: any) => p.area === area);
        return new EmbedBuilder()
            .setTitle('<:red_ga_rdd:1283548347575177238> Backup de Dados - Reboque de Staff')
            .setColor(0xFF6B6B)
            .setDescription(`Backup dos dados de **${backupData.username}** na área **${area}**`)
            .addFields({ name: '<a:mov_call1:1252739847614103687> Usuário', value: `<@${backupData.userId}>\n\`${backupData.userId}\``, inline: true }, { name: '<a:mov_call1:1252739847614103687> Área', value: area, inline: true }, { name: '<a:mov_call1:1252739847614103687> Pontos na Área', value: areaPoints?.points?.toString() || '0', inline: true }, { name: '<a:mov_call1:1252739847614103687> Motivo do Reboque', value: backupData.reason }, { name: '<a:mov_call1:1252739847614103687> Executor', value: `<@${backupData.executor}>`, inline: true }, { name: '<a:mov_call1:1252739847614103687> Data/Hora', value: `<t:${Math.floor(new Date(backupData.reboqueDate).getTime() / 1000)}:F>`, inline: true })
            .setFooter({ text: 'Backup automático gerado pelo sistema de reboque', iconURL: undefined })
            .setTimestamp();
    }
    private async removeFromDatabase(targetId: string): Promise<void> {
        try {
            if (DatabaseManager.current === 'sqlite') {
                const db = DatabaseManager.getSqlite().connection;
                await new Promise<void>((resolve, reject) => {
                    db.run('DELETE FROM points WHERE user_id = ?', [targetId], (err: any) => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
                await new Promise<void>((resolve, reject) => {
                    db.run('DELETE FROM point_logs WHERE user_id = ?', [targetId], (err: any) => {
                        if (err)
                            reject(err);
                        else
                            resolve();
                    });
                });
            }
            else {
                const mongo = DatabaseManager.getMongo().database;
                await mongo.collection('points').deleteMany({ user_id: targetId });
                await mongo.collection('point_logs').deleteMany({ user_id: targetId });
            }
            logger.info({ targetId }, 'Usuário removido da database com sucesso');
        }
        catch (error) {
            logger.error({ error, targetId }, 'Erro ao remover usuário da database');
            throw error;
        }
    }
    private async sendReboqueLog(targetId: string, executorId: string, reason: string, userInfo: any, backupData: UserBackupData, rolesRemoved: number, cfg: any): Promise<boolean> {
        try {
            const logChannelId = '1358179281553068274';
            const channel = await this.client.channels.fetch(logChannelId).catch(() => null);
            if (!channel || !channel.isTextBased()) {
                logger.warn({ logChannelId }, 'Canal de log não encontrado!');
                return false;
            }
            const embed = new EmbedBuilder()
                .setTitle('<:red_ga_rdd:1283548347575177238> STAFF REBOCADO')
                .setColor(0xFF0000)
                .setDescription('**Um staff foi rebocado do servidor!**')
                .addFields({
                name: '<a:mov_call1:1252739847614103687> Staff Rebocado',
                value: `${userInfo?.username || 'Usuário desconhecido'}\n<@${targetId}>\n\`${targetId}\``,
                inline: true
            }, {
                name: '<a:mov_call1:1252739847614103687> Executor',
                value: `<@${executorId}>\n\`${executorId}\``,
                inline: true
            }, {
                name: '<a:mov_call1:1252739847614103687> Data/Hora',
                value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                inline: true
            }, {
                name: '<a:mov_call1:1252739847614103687> Motivo',
                value: reason || 'Não especificado'
            }, {
                name: '<a:mov_call1:1252739847614103687> Informações',
                value: `<:redcdw:1361836140369543351> **Cargos removidos:** ${rolesRemoved}\n` +
                    `<:redcdw:1361836140369543351> **Total de pontos:** ${backupData.totalPoints}\n` +
                    `<:redcdw:1361836140369543351> **Áreas ativas:** ${backupData.areas.length}\n` +
                    `<:redcdw:1361836140369543351> **Backups enviados:** ${backupData.areas.length}`,
                inline: false
            }, {
                name: '<a:mov_call1:1252739847614103687> Áreas Afetadas',
                value: backupData.areas.length > 0 ? backupData.areas.join(', ') : 'Nenhuma',
                inline: false
            })
                .setThumbnail(userInfo?.avatarURL || null)
                .setFooter({ text: 'Sistema de Reboque - Jake CDW', iconURL: undefined })
                .setTimestamp();
            await (channel as TextChannel).send({ embeds: [embed] });
            return true;
        }
        catch (error) {
            logger.error({ error, targetId, executorId }, 'Erro ao enviar log de reboque');
            return false;
        }
    }
}
