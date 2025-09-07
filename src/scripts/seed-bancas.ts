import { config as loadEnv } from 'dotenv';
loadEnv();
import { BancaService } from '../services/bancaService.ts';
import { loadConfig } from '../config/index.ts';
import { logger } from '../utils/logger.ts';

const recruitBancas: { channelId: string; name: string; staffId: string }[] = [

];

async function main() {
  const cfg: any = loadConfig();
  const recruitCfg = cfg.recruitBanca;
  if (!recruitCfg) {
    logger.error('Config recruitBanca ausente. Abortando.');
    process.exit(1);
  }
  const service = new BancaService();
  let created = 0; let skipped = 0;
  for (const b of recruitBancas) {
    try {
      const exists = await service.getByChannel(b.channelId).catch(()=>null);
      if (exists) { skipped++; continue; }
      await service.create(b.channelId, b.name, b.staffId);
      created++;
      logger.info({ channel: b.channelId, name: b.name }, 'Banca registrada');
    } catch (err) {
      logger.error({ err, channel: b.channelId }, 'Falha ao registrar banca');
    }
  }
  logger.info({ created, skipped }, 'Seed de bancas finalizado');
  process.exit(0);
}

main().catch(err => { logger.error({ err }, 'Erro geral no seed'); process.exit(1); });
