import { Client, EmbedBuilder, TextBasedChannel } from 'discord.js';
import { loadConfig } from '../config/index.ts';
interface PointsLogPayload {
    userId: string;
    moderatorId: string;
    area: string;
    delta: number;
    total: number;
    reason: string;
}
function getSupportPointsLog(cfg: any) {
    return cfg.support?.channels?.pointsLog || cfg.channels?.pointsLog || null;
}
function formatReason(reason: string) {
    const r = (reason || '').trim();
    if (!r)
        return '—';
    return r.length > 250 ? r.slice(0, 247) + '…' : r;
}
export async function sendPointsLog(client: Client, type: 'adicionado' | 'removido', payload: PointsLogPayload) {
    if (!client?.guilds?.cache?.size)
        return;
    const guilds = [...client.guilds.cache.values()];
    const cfg: any = loadConfig();
    const recruitChannelId = cfg.recruitBanca?.pointsLogChannelId || cfg.channels?.recruitPointsLog || cfg.channels?.recruitRanking;
    const areaLower = payload.area.toLowerCase();
    const targetGuilds = guilds.filter(g => {
        if (areaLower === 'recrutamento')
            return true;
        if (areaLower === 'suporte' && cfg.banca?.supportGuildId)
            return g.id === cfg.banca.supportGuildId;
        return false;
    });
    function pickChannel(g: any): TextBasedChannel | undefined {
        let id: string | undefined;
        if (areaLower === 'recrutamento')
            id = recruitChannelId;
        else if (areaLower === 'suporte')
            id = getSupportPointsLog(cfg) || undefined;
        else
            id = undefined;
        if (!id)
            return undefined;
        const ch = g.channels.cache.get(id);
        return ch && 'send' in ch ? ch as TextBasedChannel : undefined;
    }
    const positive = payload.delta > 0;
    const color = positive ? 0x2ecc71 : 0xe74c3c;
    const arrow = positive ? '⬆️' : '⬇️';
    const sign = (positive ? '+' : '') + payload.delta;
    const champion = cfg.emojis?.champion || '<a:champion:placeholder>';
    const dot = cfg.emojis?.dot || '•';
    const title = positive ? `${champion} Pontos Adicionados` : `${champion} Pontos Removidos`;
    const embed = new EmbedBuilder()
        .setTitle(title + ' • ' + payload.area)
        .setColor(color)
        .setDescription([
        `${dot} **Usuário**\n<@${payload.userId}> (${payload.userId})`,
        `${dot} **Staff**\n<@${payload.moderatorId}> (${payload.moderatorId})`,
        `${dot} **Área**\n${payload.area}`,
        `${dot} **Motivo**\n${formatReason(payload.reason)}`,
        `${dot} **Alteração**\n${arrow} ${sign} pts`,
        `${dot} **Total**\n${payload.total} pts`
    ].join('\n\n'))
        .setTimestamp(new Date());
    for (const g of targetGuilds) {
        try {
            const member = await g.members.fetch(payload.userId).catch(() => null);
            if (member?.user?.avatarURL())
                embed.setThumbnail(member.user.avatarURL()!);
        }
        catch { }
        const channel = pickChannel(g);
        if (!channel)
            continue;
        try {
            await (channel as any).send({ embeds: [embed] });
        }
        catch { }
    }
}
