import { Client } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { scheduleWeeklyTasks } from '../scheduling/weekly.ts';
import { scheduleRankingUpdater } from '../scheduling/ranking.ts';
export default async function ready(client: Client) {
    logger.info({ tag: client.user?.tag }, 'Jake tá on porra, vamo botar pra fude!');
    scheduleWeeklyTasks(client);
    scheduleRankingUpdater(client);
}
