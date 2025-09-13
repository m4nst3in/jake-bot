import cron from 'node-cron';
import { Client } from 'discord.js';
import { PointsService } from '../services/pointsService.ts';
import { logger } from '../utils/logger.ts';
import { loadConfig } from '../config/index.ts';
import { markRankingUpdate } from '../commands/status.ts';
const svc = new PointsService();
export function scheduleRankingUpdater(client: Client) {
    const cfg = loadConfig();
    const supportChannelId = (cfg as any).support?.channels?.ranking || (cfg as any).channels?.ranking;
    const recruitChannelId = (cfg as any).channels?.recruitRanking;
    const designGuildId = cfg.areas?.find?.((a: any) => a.name === 'DESIGN')?.guildId;
    const designChannelId = (cfg.channels as any)?.designRanking;
    const eventsChannelId = (cfg.channels as any)?.eventsRanking;
    const journalismChannelId = (cfg.channels as any)?.journalismRanking;
    if (!supportChannelId && !recruitChannelId && !designChannelId && !eventsChannelId) {
        logger.warn('Nenhum canal de ranking configurado.');
        return;
    }
    cron.schedule('*/10 * * * *', async () => {
        try {
            async function processChannel(channelId: string, forcedArea?: string) {
                const channel: any = await client.channels.fetch(channelId).catch(() => null);
                if (!channel || !channel.isTextBased())
                    return;
                let area = forcedArea;
                if (!area) {
                    const guildId = channel.guild?.id;
                    if (guildId) {
                        const exact = cfg.areas.find((a: any) => a.guildId === guildId);
                        if (exact)
                            area = exact.name.charAt(0) + exact.name.slice(1).toLowerCase();
                        else if (cfg.banca && cfg.banca.supportGuildId === guildId)
                            area = 'Suporte';
                    }
                }
                if (!area)
                    return;
                const embed = await svc.buildRankingEmbedUnified(area);
                if (area.toLowerCase() !== 'recrutamento') {
                    (embed as any).setImage && (embed as any).setImage('https://i.imgur.com/MaXRcNR.gif');
                }
                if (area.toLowerCase() === 'suporte') {
                    (embed as any).setColor && (embed as any).setColor(0xFFFFFF);
                }
                if (area.toLowerCase() === 'movcall') {
                    (embed as any).setColor && (embed as any).setColor(0x8B0000);
                }
                if (area.toLowerCase() === 'recrutamento') {
                    const primary = cfg.emojis?.recruitPrimary || '★';
                    const arrow = cfg.emojis?.recruitArrow || '→';
                    const dOrig = (embed as any).data?.description || (embed as any).description || '';
                    const pointsPerMsg = (cfg as any).recruitBanca?.pointsPerMessage || 10;
                    const augmented = dOrig.split('\n').map((line: string) => {
                        if (!line.trim())
                            return line;
                        if (/recrut\./i.test(line))
                            return line;
                        const m = line.match(/\*\*(\d+)\*\* pts/);
                        const pts = m ? parseInt(m[1], 10) : 0;
                        const recrut = Math.floor(pts / pointsPerMsg);
                        if (/recrut\./i.test(line))
                            return line;
                        return `${line} • ${recrut} recrut.`;
                    }).join('\n');
                    const withEmojis = augmented.split('\n').map((line: string) => {
                        if (!line.trim())
                            return line;
                        return line.replace(/^.*?\*\*(\d+)\.\*\*/, (m, idx) => `${primary} **${idx}.**`).replace(/—/, `${arrow}`);
                    }).join('\n');
                    if ((embed as any).data)
                        (embed as any).data.description = withEmojis;
                    else
                        (embed as any).setDescription(withEmojis);
                    (embed as any).setColor && (embed as any).setColor(0x39ff14);
                    const crown = '<a:white_coroacr:1414470662810112022>';
                    const currentTitle = (embed as any).data?.title || (embed as any).title || '';
                    const baseTitle = 'Ranking • Recrutamento';
                    if ((embed as any).setTitle) {
                        (embed as any).setTitle(`${crown} ${baseTitle}`);
                    }
                    else if ((embed as any).data) {
                        (embed as any).data.title = `${crown} ${baseTitle}`;
                    }
                }
                const msgs = await channel.messages.fetch({ limit: 20 }).catch(() => null);
                if (msgs) {
                    const toDelete = msgs.filter((m: any) => m.author?.id === client.user?.id);
                    for (const m of toDelete.values())
                        await m.delete().catch(() => { });
                }
                await channel.send({ embeds: [embed] });
                logger.info({ area }, 'Ranking atualizado (recriado).');
                try {
                    markRankingUpdate();
                }
                catch { }
            }
            if (supportChannelId)
                await processChannel(supportChannelId);
            if (recruitChannelId)
                await processChannel(recruitChannelId, 'Recrutamento');
            if (eventsChannelId) {
                try {
                    const evCh: any = await client.channels.fetch(eventsChannelId).catch(() => null);
                    if (evCh && evCh.isTextBased()) {
                        const area = 'Eventos';
                        const embed = await svc.buildRankingEmbedUnified(area);
                        (embed as any).setColor && (embed as any).setColor(0xFFFFFF);
                        const guildId = evCh.guild?.id;
                        if (guildId) {
                            const movGuild = (cfg.areas || []).find((a: any) => a.name === 'MOVCALL')?.guildId;
                            if (movGuild && guildId === movGuild) {
                                (embed as any).setColor && (embed as any).setColor(0x8B0000);
                            }
                        }
                        const raw = (embed as any).data?.description || (embed as any).description || '';
                        const arrowEmoji = '<:emoji_73:1406097351747178496>';
                        const adjusted = raw.split('\n').map((line: string) => {
                            if (!line.trim())
                                return line;
                            return line.replace(/—/g, `${arrowEmoji}`);
                        }).join('\n');
                        if ((embed as any).data)
                            (embed as any).data.description = adjusted;
                        else
                            (embed as any).setDescription(adjusted);
                        (embed as any).setColor && (embed as any).setColor(0x9B59BB);
                        (embed as any).setImage && (embed as any).setImage('https://i.imgur.com/UQjTfr8.gif');
                        const prev = await evCh.messages.fetch({ limit: 10 }).catch(() => null);
                        if (prev) {
                            const toDelete = prev.filter((m: any) => m.author?.id === client.user?.id);
                            for (const m of toDelete.values())
                                await m.delete().catch(() => { });
                        }
                        await evCh.send({ embeds: [embed] });
                        logger.info({ area }, 'Ranking Eventos atualizado.');
                        try {
                            markRankingUpdate();
                        }
                        catch { }
                    }
                }
                catch (err) {
                    logger.error({ err }, 'Falha ranking eventos');
                }
            }
            if (journalismChannelId) {
                try {
                    const jrCh: any = await client.channels.fetch(journalismChannelId).catch(() => null);
                    if (jrCh && jrCh.isTextBased()) {
                        const area = 'Jornalismo';
                        const embed = await svc.buildRankingEmbedUnified(area);
                        const raw = (embed as any).data?.description || (embed as any).description || '';
                        const arrowEmoji = '<a:p_arrow:1312933317326143623>';
                        const adjusted = raw.split('\n').map((line: string) => {
                            if (!line.trim())
                                return line;
                            return line.replace(/—/g, `${arrowEmoji}`);
                        }).join('\n');
                        if ((embed as any).data)
                            (embed as any).data.description = adjusted;
                        else
                            (embed as any).setDescription(adjusted);
                        (embed as any).setColor && (embed as any).setColor(0xFFB6ED);
                        (embed as any).setTitle && (embed as any).setTitle('<:p_bow02:1312933529100750858> Ranking Jornalismo <:p_bow02:1312933529100750858>');
                        const prev = await jrCh.messages.fetch({ limit: 10 }).catch(() => null);
                        if (prev) {
                            const toDelete = prev.filter((m: any) => m.author?.id === client.user?.id);
                            for (const m of toDelete.values())
                                await m.delete().catch(() => { });
                        }
                        await jrCh.send({ embeds: [embed] });
                        logger.info({ area }, 'Ranking Jornalismo atualizado.');
                        try {
                            markRankingUpdate();
                        }
                        catch { }
                    }
                }
                catch (err) {
                    logger.error({ err }, 'Falha ranking jornalismo');
                }
            }
            try {
                const dChannel: any = await client.channels.fetch(designChannelId).catch(() => null);
                if (dChannel && dChannel.isTextBased()) {
                    const area = 'Design';
                    const rankingEmbed = await svc.buildRankingEmbedUnified(area);
                    const rawDesc = (rankingEmbed as any).data?.description || (rankingEmbed as any).description || '';
                    const champion = '<a:champion78:1312240136796242021>';
                    const arrow = '<a:8_white_arrow:1313295533963481122>';
                    const cleaned = rawDesc.split('\n')
                        .filter((l: string) => l.trim())
                        .map((line: string) => {
                        const m = line.match(/\*\*(\d+)\.\*\* <@(\d+)> — (\*\*?)(\d+)(?:\*\*)? pts/i);
                        if (m) {
                            const pos = m[1];
                            const userId = m[2];
                            const pts = m[4];
                            const prefix = pos === '1' ? champion : arrow;
                            return `${prefix} **${pos}.** <@${userId}> — ${pts} pts`;
                        }
                        return line;
                    })
                        .join('\n');
                    (rankingEmbed as any).setTitle && (rankingEmbed as any).setTitle('Ranking Design');
                    if ((rankingEmbed as any).data)
                        (rankingEmbed as any).data.description = cleaned;
                    else
                        (rankingEmbed as any).setDescription(cleaned);
                    (rankingEmbed as any).setColor && (rankingEmbed as any).setColor(0xE67E22);
                    (rankingEmbed as any).setImage && (rankingEmbed as any).setImage(null);
                    const prev = await dChannel.messages.fetch({ limit: 10 }).catch(() => null);
                    if (prev) {
                        const toDelete = prev.filter((m: any) => m.author?.id === client.user?.id);
                        for (const m of toDelete.values())
                            await m.delete().catch(() => { });
                    }
                    await dChannel.send({ embeds: [rankingEmbed] });
                    logger.info({ area: 'Design' }, 'Ranking Design atualizado (especial).');
                    try {
                        markRankingUpdate();
                    }
                    catch { }
                }
            }
            catch (err) {
                logger.error({ err }, 'Falha ranking design');
            }
        }
        catch (err) {
            logger.error({ err }, 'Falha ao atualizar ranking de pontos.');
        }
    });
}
export default scheduleRankingUpdater;
