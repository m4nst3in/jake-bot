import { Client } from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { logger } from './logger.ts';

export async function assignRppRolesToAllGuilds(client: Client, userId: string) {
  const cfg: any = loadConfig();
  const guildEntries = Object.entries(cfg.rpp?.guilds || {});
  if (!guildEntries.length) return;
  for (const [guildId, data] of guildEntries) {
    const roleId = (data as any).role;
    if (!roleId) continue;
    try {
      const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(()=>null);
      if (!guild) continue;
      const member = await guild.members.fetch(userId).catch(()=>null);
      if (!member) continue;
      if (!member.roles.cache.has(roleId)) {
        await member.roles.add(roleId).catch(()=>null);
        logger.info({ userId, guildId, roleId }, 'Cargo rpp atribuído');
      }
    } catch (e) {
      logger.warn({ err: (e as any)?.message, userId, guildId }, 'Falha ao atribuir cargo rpp');
    }
  }
}
