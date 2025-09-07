import { Message, AttachmentBuilder, WebhookClient } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { PointsService } from '../services/pointsService.ts';
import { BancaService } from '../services/bancaService.js';
import { loadConfig } from '../config/index.ts';
const pointsService = new PointsService();
const bancaService = new BancaService();

const bancaWebhookCache = new Map<string, { id: string; token: string }>();
const pointsWebhookCache = new Map<string, { id: string; token: string }>();

async function replicateToPointsLog(message: Message, supportCfg: any) {
    try {
        const pointsLogChannelId = supportCfg?.channels?.pointsLog || '1414091584210735135';
        const pointsLogChannel: any = await message.client.channels.fetch(pointsLogChannelId).catch(()=>null);
        if (!pointsLogChannel || !pointsLogChannel.isTextBased()) return;
        let webhookData = pointsWebhookCache.get(pointsLogChannelId);
        if (!webhookData) {
            const hooks = await pointsLogChannel.fetchWebhooks().catch(()=>null);
            const existing = hooks?.find((w:any) => w.name === 'Points Logger');
            let hook = existing;
            if (!hook) hook = await pointsLogChannel.createWebhook({ name: 'Points Logger' }).catch(()=>null);
            if (hook) {
                webhookData = { id: hook.id, token: hook.token! };
                pointsWebhookCache.set(pointsLogChannelId, webhookData);
            }
        }
        const imageAtts = [...message.attachments.values()].filter(a => (a.contentType||'').startsWith('image') || /(png|jpe?g|gif|webp)$/i.test(a.name||''));
        const files = await Promise.all(imageAtts.map(async a => new AttachmentBuilder(a.url).setName(a.name || 'image.png')));
        const content = message.content || (files.length ? '' : '');
        if (webhookData) {
            const hookClient = new WebhookClient({ id: webhookData.id, token: webhookData.token });
            await hookClient.send({
                content,
                username: message.member?.displayName || message.author.username,
                avatarURL: message.author.displayAvatarURL({ size: 128 }),
                allowedMentions: { parse: [] },
                files
            }).catch(()=>{});
        } else {
            await pointsLogChannel.send({ content, files }).catch(()=>{});
        }
    } catch (err) {
        logger.warn({ err }, 'Falha ao replicar mensagem para pointsLog');
    }
}

async function replicateToBancaLog(message: Message, supportCfg: any) {
    try {
        const bancaLogChannelId = supportCfg?.channels?.bancaLog || '1307017660260810762';
        const bancaLogChannel: any = await message.client.channels.fetch(bancaLogChannelId).catch(()=>null);
        if (!bancaLogChannel || !bancaLogChannel.isTextBased()) return;
        let webhookData = bancaWebhookCache.get(bancaLogChannelId);
        if (!webhookData) {
            const hooks = await bancaLogChannel.fetchWebhooks().catch(()=>null);
            const existing = hooks?.find((w:any) => w.name === 'Banca Logger');
            let hook = existing;
            if (!hook) hook = await bancaLogChannel.createWebhook({ name: 'Banca Logger' }).catch(()=>null);
            if (hook) {
                webhookData = { id: hook.id, token: hook.token! };
                bancaWebhookCache.set(bancaLogChannelId, webhookData);
            }
        }
        const imageAtts = [...message.attachments.values()].filter(a => (a.contentType||'').startsWith('image') || /(png|jpe?g|gif|webp)$/i.test(a.name||''));
        const files = await Promise.all(imageAtts.map(async a => new AttachmentBuilder(a.url).setName(a.name || 'image.png')));
        const content = message.content || (files.length ? '' : '');
        if (webhookData) {
            const hookClient = new WebhookClient({ id: webhookData.id, token: webhookData.token });
            await hookClient.send({
                content,
                username: message.member?.displayName || message.author.username,
                avatarURL: message.author.displayAvatarURL({ size: 128 }),
                allowedMentions: { parse: [] },
                files
            }).catch(()=>{});
        } else {
            await bancaLogChannel.send({ content, files }).catch(()=>{});
        }
    } catch (err) {
        logger.warn({ err }, 'Falha ao replicar mensagem para bancaLog');
    }
}
function parseReport(content: string) {
    const lines = content.split(/\n+/).map(l => l.trim());
    const idLine = lines.find(l => /^ID[:=-]/i.test(l));
    const acLine = lines.find(l => /^Acontecimento[:=-]/i.test(l));
    const reLine = lines.find(l => /^Resolu(ção|cao)[:=-]/i.test(l));
    const errors: string[] = [];
    if (!idLine) errors.push('Falta ID');
    if (!acLine) errors.push('Falta Acontecimento');
    if (!reLine) errors.push('Falta Resolução');
    return { valid: errors.length === 0, errors };
}
function extractEmojiId(raw: string) {
    const m = raw.match(/<a?:[^:]+:(\d+)>/); return m ? m[1] : raw;
}
export default async function messageCreate(message: Message) {
    try {
        if (message.author.bot) return;
    const cfg = loadConfig();
    const supportCfg: any = (cfg as any).support;
        const reportsChannelId = process.env.REPORTS_CHANNEL_ID;
                const PLANTAO_CHANNEL = supportCfg?.channels?.plantao || '1294070656194838529';
                const SUPERVISAO_CHANNEL = supportCfg?.channels?.plantaoSupervisao || '1332541696608571505';
                const SUPERVISAO_ROLE = supportCfg?.roles?.supervisao || '1190515971144818760';
                const LOG_CHANNEL = supportCfg?.channels?.plantaoLog || '1414103437657767986';
                const ACCEPT_EMOJI = supportCfg?.emojis?.checkAnim || '<a:check2:1413993680313909350>';
                if (message.guild && message.channelId === PLANTAO_CHANNEL) {

                        if (/(https?:\/\/\S+)/i.test(message.content)) {
                                await message.react(ACCEPT_EMOJI).catch(() => {});
                                try {
                                        const supervisaoChannel: any = await message.client.channels.fetch(SUPERVISAO_CHANNEL).catch(()=>null);
                                        if (supervisaoChannel && supervisaoChannel.isTextBased()) {
                                                const { EmbedBuilder, ActionRowBuilder, ButtonBuilder } = await import('discord.js');
                                                const ts = Math.floor(message.createdTimestamp/1000);
                                                const embed = new EmbedBuilder()
                                                    .setTitle('🕒 Supervisão de Plantão')
                                                    .setColor(0x8e44ad)
                                                    .setDescription(`Solicitação de supervisão registrada.\n\n👤 **Usuário**: <@${message.author.id}>\n🕘 **Horário**: <t:${ts}:F>\n\n<@&${SUPERVISAO_ROLE}> favor supervisionar.`)
                                                    .setFooter({ text: `Msg ${message.id}` })
                                                    .setTimestamp();
                                                const row = new ActionRowBuilder().addComponents(
                                                    new ButtonBuilder().setCustomId(`plantao_accept:${message.id}:${message.author.id}`).setLabel('Aceitar').setStyle(3).setEmoji('✅'),
                                                    new ButtonBuilder().setCustomId(`plantao_reject:${message.id}:${message.author.id}`).setLabel('Recusar').setStyle(4).setEmoji('❌')
                                                );
                                                await supervisaoChannel.send({ content: `<@&${SUPERVISAO_ROLE}>`, embeds:[embed], components:[row] });
                                        }

                                        const logChannel: any = await message.client.channels.fetch(LOG_CHANNEL).catch(()=>null);
                                        if (logChannel && logChannel.isTextBased()) {
                                                const { EmbedBuilder } = await import('discord.js');
                                                const embed = new EmbedBuilder()
                                                    .setTitle('🗂️ Novo Plantão')
                                                    .setColor(0x34495e)
                                                    .setDescription(`Usuário: <@${message.author.id}> (${message.author.id})\nCanal origem: <#${PLANTAO_CHANNEL}>\nMensagem: [Ir para a mensagem](${message.url})`)
                                                    .setTimestamp();
                                                await logChannel.send({ embeds:[embed] });
                                        }
                                } catch {}
                        }
                }

                if (message.guild && [PLANTAO_CHANNEL, SUPERVISAO_CHANNEL, LOG_CHANNEL].includes(message.channelId)) {
                    await replicateToBancaLog(message, supportCfg);

                    await replicateToPointsLog(message, supportCfg);
                }
        if (reportsChannelId && message.channelId === reportsChannelId) {
            const parsed = parseReport(message.content);
            if (parsed.valid) {
                await message.react('✅').catch(() => {});
                await pointsService.registrarReport(message.author.id, 'Suporte', 1, 'system');
            } else {
                await message.author.send(`Seu relatório possui erros:\n- ${parsed.errors.join('\n- ')}`).catch(() => {});
            }
            return;
        }
        if (!message.guild) return;

        const recruitCfg: any = (cfg as any).recruitBanca;
        if (recruitCfg && message.guild.id === recruitCfg.guildId) {

            const banca = await bancaService.getByChannel(message.channel.id).catch(()=>null);
            if (banca) {
                const contentLower = message.content.toLowerCase();
                const keyword = (recruitCfg.keyword || 'recrutamento').toLowerCase();
                if (contentLower.includes(keyword)) {

                    await (pointsService as any).adicionarComRelatorio(message.author.id, 'Recrutamento', recruitCfg.pointsPerMessage || 10, message.author.id);
                    const emojiId = extractEmojiId(recruitCfg.reactionEmoji || '<a:Check:1217789508939157515>');
                    await message.react(emojiId).catch(()=>{});
                    if (recruitCfg.bannerUrl) {
                        const ch:any = message.channel as any;
                        if (typeof ch.send === 'function') await ch.send(recruitCfg.bannerUrl).catch(()=>{});
                    }

                    if (recruitCfg.pointsLogChannelId) {
                        const logCh: any = await message.client.channels.fetch(recruitCfg.pointsLogChannelId).catch(()=>null);
                        if (logCh && logCh.isTextBased()) {
                            const { EmbedBuilder } = await import('discord.js');
                            const embed = new EmbedBuilder()
                              .setTitle('Pontos de Recrutamento')
                              .setColor(0x2ecc71)
                              .setDescription(`**Usuário:** <@${message.author.id}> (${message.author.id})\n**Pontos:** +${recruitCfg.pointsPerMessage || 10}\n**Canal:** <#${message.channel.id}>`)
                              .setTimestamp();
                            await logCh.send({ embeds: [embed] }).catch(()=>{});
                        }
                    }
                }
            }
            return;
        }

        if (!cfg.banca) return;
        if (message.guild.id !== cfg.banca.supportGuildId) return;
    const banca = await bancaService.getByChannel(message.channel.id);
    const isAvisoChannel = message.channel.id === (supportCfg?.channels?.bancaBonus || cfg.banca.bonusChannelId);
    const isSupervisaoBancaChannel = message.channel.id === (supportCfg?.channels?.bancaSupervisao || cfg.banca.supervisionChannelId);
    if (!banca && !(isAvisoChannel || isSupervisaoBancaChannel)) return;
    const failEmojiId = extractEmojiId(supportCfg?.emojis?.fail || '<:waterrado:1413997059853516932>');

    if (banca && banca.staff_id && !isAvisoChannel && !isSupervisaoBancaChannel && message.author.id !== banca.staff_id) { await message.react(failEmojiId).catch(()=>{}); return; }

    if (!message.attachments.size) { await message.react(failEmojiId).catch(()=>{}); return; }
    const hasImage = [...message.attachments.values()].some(a => (a.contentType||'').startsWith('image') || /\.(png|jpe?g|gif|webp)$/i.test(a.name||''));
    if (!hasImage) { await message.react(failEmojiId).catch(()=>{}); return; }
    logger.info({ banca: banca||null, author: message.author.id, aviso: isAvisoChannel, supervisao: isSupervisaoBancaChannel }, 'Banca/aviso/supervisao message candidate');
    let pts = cfg.banca.basePoints;
    if (isAvisoChannel) pts = cfg.banca.bonusPoints;
    else if (isSupervisaoBancaChannel) pts = cfg.banca.supervisionPoints;
    else if (message.channel.id === (supportCfg?.channels?.bancaBonus || cfg.banca.bonusChannelId)) pts = cfg.banca.bonusPoints;
    else if (message.channel.id === (supportCfg?.channels?.bancaSupervisao || cfg.banca.supervisionChannelId)) pts = cfg.banca.supervisionPoints;
    await (pointsService as any).adicionarComRelatorio(message.author.id, 'Suporte', pts, message.author.id);
    logger.info({ user: message.author.id, pts, aviso: isAvisoChannel, supervisao: isSupervisaoBancaChannel }, 'Banca/aviso/supervisao points added');
    const emojiId = extractEmojiId(supportCfg?.emojis?.checkAnim || cfg.banca.reactionEmoji);
    await message.react(emojiId).catch(()=>{});

    if (banca || isAvisoChannel || isSupervisaoBancaChannel) {
        const ch:any = message.channel as any;
        if (typeof ch.send === 'function') await ch.send(cfg.banca.bannerUrl).catch(()=>{});
    }

    await replicateToBancaLog(message, supportCfg);

    } catch (err) {
        logger.error({ err }, 'Erro em messageCreate');
    }
}
