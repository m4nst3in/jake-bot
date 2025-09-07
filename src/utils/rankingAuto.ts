import { Message, EmbedBuilder } from 'discord.js';
import { PointsService } from '../services/pointsService.ts';

interface Tracker { interval: NodeJS.Timeout; area: string; messageId: string; channelId: string; }
const trackers = new Map<string, Tracker>();
const GIF_URL = 'https://i.imgur.com/MaXRcNR.gif';

export function startRankingAutoUpdate(message: Message, area: string, svc = new PointsService()){ 
  for (const [id, t] of trackers) {
    if (t.channelId === message.channel.id && t.area === area) { clearInterval(t.interval); trackers.delete(id); }
  }
  const interval = setInterval(async () => {
    try {
      const embed = await svc.richRanking(area);
      (embed as EmbedBuilder).setImage(GIF_URL);
      await message.edit({ embeds: [embed] });
    } catch {}
  }, 10.000);
  trackers.set(message.id, { interval, area, messageId: message.id, channelId: message.channel.id });
}

export function stopAllRankingAuto(){ for (const t of trackers.values()) clearInterval(t.interval); trackers.clear(); }
