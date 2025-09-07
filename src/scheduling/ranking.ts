import cron from 'node-cron';
import { Client } from 'discord.js';
import { PointsService } from '../services/pointsService.ts';
import { logger } from '../utils/logger.ts';
import { loadConfig } from '../config/index.ts';

const svc = new PointsService();

export function scheduleRankingUpdater(client: Client){
  const cfg = loadConfig();
  const supportChannelId = (cfg as any).support?.channels?.ranking || (cfg as any).channels?.ranking;
  const recruitChannelId = (cfg as any).channels?.recruitRanking;
  if(!supportChannelId && !recruitChannelId){
    logger.warn('Nenhum canal de ranking configurado.');
    return; }
  // A cada 10 minutos
  cron.schedule('*/10 * * * *', async () => {
    try {
      async function processChannel(channelId: string, forcedArea?: string){
        const channel: any = await client.channels.fetch(channelId).catch(()=>null);
        if(!channel || !channel.isTextBased()) return;
        let area = forcedArea;
        if (!area) {
          const guildId = channel.guild?.id;
          if (guildId){
            const exact = cfg.areas.find((a:any)=>a.guildId === guildId);
            if (exact) area = exact.name.charAt(0)+exact.name.slice(1).toLowerCase();
            else if (cfg.banca && cfg.banca.supportGuildId === guildId) area = 'Suporte';
          }
        }
        if (!area) return;
        const embed = await svc.buildRankingEmbedUnified(area);
        if (area.toLowerCase() !== 'recrutamento') {
          (embed as any).setImage && (embed as any).setImage('https://i.imgur.com/MaXRcNR.gif');
        }
        if (area.toLowerCase() === 'recrutamento') {
          const primary = '<a:d_brabuleta:1185777338907099197>';
          const arrow = '<a:vSETAverdeclaro:1386504186396676141>';
          const dOrig = (embed as any).data?.description || (embed as any).description || '';
          const pointsPerMsg = (cfg as any).recruitBanca?.pointsPerMessage || 10;
          const augmented = dOrig.split('\n').map((line:string)=>{
            if(!line.trim()) return line;
            if(/recrut\./i.test(line)) return line; // já processado
            const m = line.match(/\*\*(\d+)\*\* pts/);
            const pts = m ? parseInt(m[1],10) : 0;
            const recrut = Math.floor(pts / pointsPerMsg);
            return `${line} • ${recrut} recrut.`;
          }).join('\n');
          const withEmojis = augmented.split('\n').map((line:string)=>{
            if(!line.trim()) return line;
            return line.replace(/^.*?\*\*(\d+)\.\*\*/,(m,idx)=>`${primary} **${idx}.**`).replace(/—/, `${arrow}`);
          }).join('\n');
          if ((embed as any).data) (embed as any).data.description = withEmojis; else (embed as any).setDescription(withEmojis);
        }
        const msgs = await channel.messages.fetch({ limit: 20 }).catch(()=>null);
        if(msgs){
          const toDelete = msgs.filter((m:any)=> m.author?.id === client.user?.id);
          for(const m of toDelete.values()) await m.delete().catch(()=>{});
        }
        await channel.send({ embeds:[embed] });
        logger.info({ area }, 'Ranking atualizado (recriado).');
      }
      if (supportChannelId) await processChannel(supportChannelId);
      if (recruitChannelId) await processChannel(recruitChannelId, 'Recrutamento');
    } catch(err){
      logger.error({ err }, 'Falha ao atualizar ranking');
    }
  });
}

export default scheduleRankingUpdater;