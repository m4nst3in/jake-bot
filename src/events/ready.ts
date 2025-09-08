import { Client } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { scheduleWeeklyTasks } from '../scheduling/weekly.ts';
import { scheduleRankingUpdater } from '../scheduling/ranking.ts';
import { StaffService } from '../services/staffService.js';
import { resolvePrimaryGuildId } from '../config/index.ts';
import { loadConfig } from '../config/index.ts';
export default async function ready(client: Client) {
    logger.info({ tag: client.user?.tag }, 'Jake tá on porra, vamo botar pra fude!');
    scheduleWeeklyTasks(client);
    scheduleRankingUpdater(client);
    try {
        const cfg = loadConfig();
        const roleId = cfg.roles?.staff || '1135122929529659472';
        const guildId = resolvePrimaryGuildId();
        if (guildId) {
            const guild = await client.guilds.fetch(guildId).catch(() => null);
            if (guild) {
                await guild.members.fetch();
                const role = guild.roles.cache.get(roleId);
                if (role) {
                    const rankRoleIds = Object.entries(cfg.roles || {})
                        .filter(([k]) => k !== 'staff')
                        .map(([, v]) => v)
                        .filter(r => !!r);
                    const svc = new StaffService();
                    const records = [...role.members.values()].map(m => {
                        const memberRankRole = m.roles.cache.find(r => rankRoleIds.includes(r.id));
                        return { id: m.id, rankRoleId: memberRankRole?.id };
                    });
                    await svc.replaceAll(records);
                    logger.info({ count: records.length }, 'Staff sincronizada (ready)');
                }
                else {
                    logger.warn('Role staff não encontrada para sincronizar');
                }
            }
        }
        else {
            logger.warn('Nenhum guildId primário resolvido para sincronizar staff');
        }
    }
    catch (e: any) {
        logger.error({ err: e }, 'Falha ao sincronizar staff inicial');
    }
}
