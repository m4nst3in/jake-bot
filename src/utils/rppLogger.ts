import { Guild, EmbedBuilder, TextBasedChannel, ActionRowBuilder, ButtonBuilder, Channel } from 'discord.js';
import { logger } from './logger.ts';
import { loadConfig } from '../config/index.ts';
interface RppLogPayload {
    id?: number | string;
    userId: string;
    moderatorId?: string;
    status?: string;
    reason?: string;
    returnDate?: string;
    createdAt?: string;
    processedAt?: string;
    area?: string;
    startedAt?: string;
}
function daysUntil(dateStr?: string) {
    if (!dateStr)
        return undefined;
    let iso = dateStr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [d, m, y] = dateStr.split('/');
        iso = `${y}-${m}-${d}`;
    }
    const target = new Date(iso + 'T00:00:00Z');
    if (isNaN(target.getTime()))
        return undefined;
    const now = new Date();
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}
function mapType(type: string) {
    switch (type) {
        case 'criado': return { title: '<a:snowflake:1313280806235672656> RPP Criado', color: 0x1f8b4c };
        case 'solicitado': return { title: '<a:snowflake:1313280806235672656> RPP Solicitado', color: 0x1f8b4c };
        case 'ativado': return { title: '<a:snowflake:1313280806235672656> RPP Iniciado', color: 0x4b9cd3 };
        case 'removido': return { title: '<a:snowflake:1313280806235672656> RPP Encerrado', color: 0x95a5a6 };
        default: return { title: '<a:snowflake:1313280806235672656> RPP', color: 0xcccccc };
    }
}
export async function sendRppLog(guild: Guild | null | undefined, type: string, payload: RppLogPayload) {
    if (!guild) return;
    const rootCfg: any = loadConfig();
    const rppCfg = rootCfg.rpp?.guilds?.[guild.id];
    if (!rppCfg) {
        throw new Error('Config RPP ausente para guild ' + guild.id + ' em bot-config.json');
    }
    const reviewChannelId = rppCfg.review;
    const logChannelId = rppCfg.log;
    const useReview = type === 'solicitado';
    let channel = guild.channels.cache.get(useReview ? reviewChannelId : logChannelId) as TextBasedChannel | undefined;
    if (!channel) {
        try {
            const fetched = await guild.channels.fetch(useReview ? reviewChannelId : logChannelId).catch(() => null);
            if (fetched && fetched.isTextBased()) channel = fetched as TextBasedChannel;
        } catch {}
    }
    if (!channel || !('send' in channel)) {
    logger.warn({ channelId: useReview ? reviewChannelId : logChannelId, type }, 'RPP log: canal não encontrado ou inválido');

        if (type === 'ativado') {
            const fallbackId = reviewChannelId;
            if (fallbackId) {
                let fb = guild.channels.cache.get(fallbackId) as TextBasedChannel | undefined;
                if (!fb) {
                    try {
                        const fetchedFb = await guild.channels.fetch(fallbackId).catch(() => null);
                        if (fetchedFb && fetchedFb.isTextBased()) fb = fetchedFb as TextBasedChannel;
                    } catch {}
                }
                if (fb && ('send' in fb)) channel = fb;
            }
        }
        if (!channel) return;
    }
    const meta = mapType(type);
    const days = daysUntil(payload.returnDate);
    const reasonRaw = (payload.reason || '').trim();
    const reason = reasonRaw ? (reasonRaw.length > 800 ? reasonRaw.slice(0, 800) + '…' : reasonRaw) : undefined;
    function mapStatus(s?: string) {
        if (!s)
            return undefined;
        const base = s.toLowerCase();
        if (base === 'ativo' || base === 'accepted')
            return 'Ativo';
        if (base === 'removido' || base === 'removed')
            return 'Encerrado';
        if (base === 'pendente' || base === 'pending')
            return 'Pendente';
        if (base === 'negado' || base === 'rejected')
            return 'Negado';
        return base.charAt(0).toUpperCase() + base.slice(1);
    }
    const parts: string[] = [];
    parts.push(`<:white_ponto:1218673656679628942> **Usuário**\n<@${payload.userId}> (${payload.userId})`);
    if (payload.moderatorId)
        parts.push(`<:white_ponto:1218673656679628942> **Staff**\n<@${payload.moderatorId}> (${payload.moderatorId})`);
    const friendlyStatus = mapStatus(payload.status);
    if (friendlyStatus)
        parts.push(`<:white_ponto:1218673656679628942> **Status**\n${friendlyStatus}`);
    if (reason)
        parts.push(`<:white_ponto:1218673656679628942> **Motivo**\n${reason}`);
    if (payload.area)
        parts.push(`<:white_ponto:1218673656679628942> **Área**\n${payload.area}`);
    if (type === 'removido' && payload.startedAt)
        parts.push(`<:white_ponto:1218673656679628942> **Início do RPP**\n${payload.startedAt}`);
    if (payload.returnDate) {
        parts.push(`<:white_ponto:1218673656679628942> **Retorno Previsto**\n${payload.returnDate}${days !== undefined ? ` (em ${days} dia${Math.abs(days) === 1 ? '' : 's'})` : ''}`);
    }
    const embed = new EmbedBuilder()
        .setTitle(meta.title)
        .setDescription(parts.join('\n\n'))
        .setColor(meta.color);
    try {
        const member = await guild.members.fetch(payload.userId).catch(() => null);
        if (member?.user?.avatarURL())
            embed.setThumbnail(member.user.avatarURL()!);
    }
    catch { }
    let components: any[] | undefined;
    if (type === 'solicitado' && payload.id !== undefined) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`rpp_accept:${payload.id}`).setLabel('ACEITAR').setStyle(3).setEmoji('<:white_certocr:1345874948589096980>'), new ButtonBuilder().setCustomId(`rpp_reject:${payload.id}`).setLabel('RECUSAR').setStyle(4).setEmoji('<:waterrado:1377911729199255602>'));
        components = [row];
    }
    try {
        await (channel as any).send({ embeds: [embed], components });
    }
    catch { }
}
