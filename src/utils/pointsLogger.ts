import { Client, EmbedBuilder, TextBasedChannel } from 'discord.js';
import { loadConfig } from '../config/index.ts';

interface PointsLogPayload {
  userId: string;
  moderatorId: string;
  area: string;
  delta: number; // positivo ou negativo
  total: number;
  reason: string;
}

// Canal default (suporte). Para recrutamento usamos channels.recruitRanking/pointsLogChannel se definido.
const DEFAULT_SUPPORT_CHANNEL_ID = '1414091584210735135';

function formatReason(reason: string){
  const r = (reason||'').trim();
  if(!r) return '—';
  return r.length > 250 ? r.slice(0,247)+'…' : r;
}

export async function sendPointsLog(client: Client, type: 'adicionado' | 'removido', payload: PointsLogPayload){
  if(!client?.guilds?.cache?.size) return;
  // Pega primeiro guild (ou poderia iterar todos caso multi-guild)
  const guilds = [...client.guilds.cache.values()];
  const cfg: any = loadConfig();
  const recruitChannelId = cfg.recruitBanca?.pointsLogChannelId || cfg.channels?.recruitPointsLog || cfg.channels?.recruitRanking;

  // filtramos guilds relevantes conforme área
  const targetGuilds = guilds.filter(g => {
    if (payload.area.toLowerCase() === 'recrutamento') return true; // qualquer guild para tentar achar canal específico
    // suporte: preferir guild suporte se configurado
    if (payload.area.toLowerCase() === 'suporte' && cfg.banca?.supportGuildId) return g.id === cfg.banca.supportGuildId;
    return true;
  });

  // Função para achar canal certo neste guild
  function pickChannel(g:any): TextBasedChannel | undefined {
    let id: string | undefined;
    if (payload.area.toLowerCase() === 'recrutamento') id = recruitChannelId;
    else id = DEFAULT_SUPPORT_CHANNEL_ID;
    if (!id) return undefined;
    const ch = g.channels.cache.get(id);
    return ch && 'send' in ch ? ch as TextBasedChannel : undefined;
  }

  const positive = payload.delta > 0;
  const color = positive ? 0x2ecc71 : 0xe74c3c;
  const arrow = positive ? '⬆️' : '⬇️';
  const sign = (positive ? '+' : '') + payload.delta;
  const title = positive ? '<a:champion78:1312240136796242021> Pontos Adicionados' : '<a:champion78:1312240136796242021> Pontos Removidos';

  const embed = new EmbedBuilder()
    .setTitle(title + ' • ' + payload.area)
    .setColor(color)
    .setDescription([
      `<:white_ponto:1218673656679628942> **Usuário**\n<@${payload.userId}> (${payload.userId})`,
      `<:white_ponto:1218673656679628942> **Staff**\n<@${payload.moderatorId}> (${payload.moderatorId})`,
      `<:white_ponto:1218673656679628942> **Área**\n${payload.area}`,
      `<:white_ponto:1218673656679628942> **Alteração**\n${arrow} ${sign} pts`,
      `<:white_ponto:1218673656679628942> **Total**\n${payload.total} pts`,
      `<:white_ponto:1218673656679628942> **Motivo**\n${formatReason(payload.reason)}`
    ].join('\n\n'))
    .setTimestamp(new Date());

  for (const g of targetGuilds) {
    try {
      const member = await g.members.fetch(payload.userId).catch(()=>null);
      if(member?.user?.avatarURL()) embed.setThumbnail(member.user.avatarURL()!);
    } catch{}
    const channel = pickChannel(g);
    if(!channel) continue;
    try { await (channel as any).send({ embeds:[embed] }); } catch{}
  }
}
