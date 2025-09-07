import { config as dotenv } from 'dotenv';
dotenv();
import { Client, IntentsBitField, PermissionsBitField } from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { BancaService } from '../services/bancaService.ts';
import { logger } from '../utils/logger.ts';

// Preencha a lista com { name, staffId }
const BANCA_LIST: { name: string; staffId: string }[] = [
  // Exemplo: { name: 'joao', staffId: '123456789012345678' },
];

async function run() {
  const cfg: any = loadConfig();
  const recruitCfg = cfg.recruitBanca;
  if (!recruitCfg) throw new Error('recruitBanca config ausente');
  const guildId = recruitCfg.guildId;
  const categoryId = recruitCfg.categoryId;
  const prefix = recruitCfg.prefix || '🟢・';
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error('DISCORD_TOKEN ausente');
  const client = new Client({ intents: [IntentsBitField.Flags.Guilds] });
  await new Promise<void>((resolve, reject)=>{ client.once('ready', ()=>resolve()); client.login(token).catch(reject); });
  const guild = await client.guilds.fetch(guildId); if (!guild) throw new Error('Guild não encontrada');
  const service = new BancaService();
  for (const b of BANCA_LIST) {
    const channelName = `${prefix}${b.name.toLowerCase().replace(/\s+/g,'-')}`;
    let channel = guild.channels.cache.find(c => c.name === channelName);
    if (!channel) {
      try {
        channel = await guild.channels.create({
          name: channelName,
          parent: categoryId,
          permissionOverwrites: [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: b.staffId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
          ]
        });
        logger.info({ channel: channel.id, name: channelName }, 'Canal criado');
      } catch (err) {
        logger.error({ err, name: channelName }, 'Falha ao criar canal');
        continue;
      }
    } else {
      logger.info({ channel: channel.id, name: channelName }, 'Canal já existe');
    }
    const exists = await service.getByChannel(channel.id).catch(()=>null);
    if (!exists) {
      await service.create(channel.id, b.name, b.staffId);
      logger.info({ channel: channel.id, staff: b.staffId }, 'Banca registrada no DB');
    } else {
      logger.info({ channel: channel.id }, 'Banca já registrada no DB');
    }
  }
  logger.info('Processo concluído');
  client.destroy();
}

run().catch(err => { logger.error({ err }, 'Erro geral'); process.exit(1); });
