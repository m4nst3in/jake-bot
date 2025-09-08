import { Client, GatewayIntentBits } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { StaffService } from '../services/staffService.js';
import { resolvePrimaryGuildId, loadConfig } from '../config/index.ts';
import { DatabaseManager } from '../db/manager.ts';
import { logger } from '../utils/logger.ts';
loadEnv();
async function main() {
    await DatabaseManager.init();
    const guildId = resolvePrimaryGuildId();
    const cfg = loadConfig();
    const roleId = cfg.roles?.staff || '1135122929529659472';
    if (!guildId)
        throw new Error('Nenhum guildId válido encontrado (configure mainGuildId ou support.guildId)');
    if (!process.env.DISCORD_TOKEN)
        throw new Error('DISCORD_TOKEN ausente');
    const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    await client.login(process.env.DISCORD_TOKEN);
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild)
        throw new Error(`Guild principal não encontrada (id=${guildId})`);
    await guild.members.fetch();
    const role = guild.roles.cache.get(roleId);
    if (!role)
        throw new Error('Cargo staff não encontrado');
    const rankRoleIds = Object.entries(cfg.roles || {})
        .filter(([k]) => k !== 'staff')
        .map(([, v]) => v)
        .filter(r => !!r);
    const records = [...role.members.values()].map(m => {
        const memberRankRole = m.roles.cache.find(r => rankRoleIds.includes(r.id));
        return { id: m.id, rankRoleId: memberRankRole?.id };
    });
    const svc = new StaffService();
    await svc.replaceAll(records);
    logger.info({ count: records.length }, 'Sincronização staff concluída');
    await client.destroy();
}
main().catch(e => { console.error('Erro sync-staff', e); process.exit(1); });
