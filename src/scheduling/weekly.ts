import cron from 'node-cron';
import { Client, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { DatabaseManager } from '../db/manager.ts';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/index.ts';
import { PointsService } from '../services/pointsService.ts';
import { generateAreaPdf } from '../utils/pdf.ts';
interface MovWindowConfig {
    channelId: string;
    roleId: string;
    closeGif: string;
    openGif: string;
    windows: string[];
    reopenAfterMinutes: number;
}
function loadMovConfig(): MovWindowConfig | null {
    try {
        const cfg: any = loadConfig();
        const m = cfg.movOrg;
        if (!m?.channelId || !m?.roleId)
            return null;
        return {
            channelId: m.channelId,
            roleId: m.roleId,
            closeGif: m.closeGif,
            openGif: m.openGif,
            windows: m.windows || [],
            reopenAfterMinutes: m.reopenAfterMinutes || 120
        };
    }
    catch {
        return null;
    }
}
let movCfgCache: MovWindowConfig | null = null;
let movState: {
    lastClose?: number;
    lastOpen?: number;
} = {};
async function sendMovEmbed(client: Client, type: 'close' | 'open') {
    movCfgCache = movCfgCache || loadMovConfig();
    if (!movCfgCache)
        return;
    const ch: any = await client.channels.fetch(movCfgCache.channelId).catch(() => null);
    if (!ch || !ch.isTextBased())
        return;
    const mention = `<@&${movCfgCache.roleId}>`;
    const closeTitle = '<a:emoji_415:1282771322555994245> ORG-MOV FECHADA';
    const openTitle = '<a:emoji_415:1282771322555994245> ORG-MOV REABERTA';
    const closeGif = movCfgCache.closeGif;
    const openGif = movCfgCache.openGif;
    const embed = new EmbedBuilder()
        .setColor(type === 'close' ? 0xe74c3c : 0x2ecc71)
        .setTitle(type === 'close' ? closeTitle : openTitle)
        .setImage(type === 'close' ? closeGif : openGif)
        .setTimestamp();
    try {
        await ch.send({ content: mention, embeds: [embed] });
        if (type === 'close')
            movState.lastClose = Date.now();
        else
            movState.lastOpen = Date.now();
    }
    catch (e) {
        logger.warn({ e }, 'Falha enviar embed mov');
    }
}
function scheduleMovWindows(client: Client) {
    movCfgCache = loadMovConfig();
    if (!movCfgCache)
        return;
    const tz = process.env.TIMEZONE || 'America/Sao_Paulo';
    movCfgCache.windows.forEach(spec => {
        cron.schedule(spec, async () => {
            await sendMovEmbed(client, 'close');
            setTimeout(() => sendMovEmbed(client, 'open'), movCfgCache!.reopenAfterMinutes * 60 * 1000);
        }, { timezone: tz });
    });
}
export function scheduleWeeklyTasks(client: Client) {
    const spec = process.env.POINTS_BACKUP_SCHEDULE || '0 0 22 * * 5';
    const tz = process.env.TIMEZONE || 'America/Sao_Paulo';
    scheduleMovWindows(client);
    cron.schedule(spec, async () => {
        logger.info('Rodando o backup semanal geral (sem reset global)');
        try {
            const data = await exportPoints();
            const { jsonBuffer, csvBuffer, count } = data;
            const channelId = process.env.BACKUP_CHANNEL_ID;
            if (channelId) {
                const ch = await client.channels.fetch(channelId).catch(() => null);
                if (ch && ch.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('🗄️ Backup Semanal')
                        .setDescription(`Backup concluído. Registros: ${count}. Nenhum reset global executado.`)
                        .setColor(0x95a5a6)
                        .setTimestamp();
                    const jsonFile = new AttachmentBuilder(jsonBuffer, { name: `pontos-backup-${Date.now()}.json` });
                    const csvFile = new AttachmentBuilder(csvBuffer, { name: `pontos-backup-${Date.now()}.csv` });
                    await (ch as any).send({ embeds: [embed], files: [jsonFile, csvFile] });
                }
            }
        }
        catch (err) {
            logger.error({ err }, 'Weekly backup failed');
        }
    }, { timezone: tz });
    cron.schedule('0 0 22 * * 5', async () => {
        const cfg = loadConfig();
        const rankingChannelId = (cfg as any).support?.channels?.ranking || (cfg as any).channels?.ranking;
        const supportBackupChannelId = '1414439918951993364';
        const journalismBackupChannelId = '1414440215468048444';
        const tzNow = new Date();
        logger.info('Executando reset semanal das áreas Suporte e Jornalismo');
        const svc = new PointsService();
        try {
            const supportArea = 'Suporte';
            const supportData = await exportAreaPoints(supportArea);
            let supportPdf: Buffer | null = null;
            try {
                supportPdf = await generateAreaPdf(client, supportArea);
            }
            catch (e) {
                logger.warn({ e }, 'Falha gerar PDF suporte pré-reset');
            }
            const journalismArea = 'Jornalismo';
            const journalismData = await exportAreaPoints(journalismArea);
            let journalismPdf: Buffer | null = null;
            try {
                journalismPdf = await generateAreaPdf(client, journalismArea);
            }
            catch (e) {
                logger.warn({ e }, 'Falha gerar PDF jornalismo pré-reset');
            }
            await resetSupportOnly();
            await resetAreaPoints('Jornalismo');
            if (rankingChannelId) {
                const ch: any = await client.channels.fetch(supportBackupChannelId).catch(() => null);
                if (ch && ch.isTextBased()) {
                    try {
                        const backupEmbed = new EmbedBuilder()
                            .setTitle('🗄️ Backup Área - Suporte')
                            .setDescription(`Registros: ${supportData.count}. Backup gerado antes do reset.`)
                            .setColor(0xFFFFFF)
                            .setTimestamp();
                        const jsonFile = new AttachmentBuilder(supportData.jsonBuffer, { name: `suporte-${Date.now()}.json` });
                        const csvFile = new AttachmentBuilder(supportData.csvBuffer, { name: `suporte-${Date.now()}.csv` });
                        const files: any[] = [jsonFile, csvFile];
                        if (supportPdf)
                            files.push({ attachment: supportPdf, name: `suporte-${Date.now()}.pdf` });
                        await ch.send({ embeds: [backupEmbed], files });
                    }
                    catch (e) {
                        logger.warn({ e }, 'Falha envio backup suporte');
                    }
                    const supportResetEmbed = new EmbedBuilder()
                        .setTitle('♻️ Reset Semanal de Pontos')
                        .setDescription('A pontuação da equipe de **Suporte** (incluindo relatórios e plantões) foi resetada.')
                        .setColor(0xFFFFFF)
                        .setFooter({ text: 'Novo ciclo iniciado', iconURL: undefined })
                        .setTimestamp();
                    try {
                        const rCh: any = await client.channels.fetch(rankingChannelId).catch(() => null);
                        if (rCh && rCh.isTextBased()) {
                            await rCh.send({ embeds: [supportResetEmbed] });
                            try {
                                const rankingEmbed = await svc.buildRankingEmbedUnified('Suporte');
                                (rankingEmbed as any).setImage && (rankingEmbed as any).setImage('https://i.imgur.com/MaXRcNR.gif');
                                await rCh.send({ embeds: [rankingEmbed] });
                            }
                            catch (e) {
                                logger.warn({ e }, 'Falha ao enviar ranking pós-reset suporte');
                            }
                        }
                    }
                    catch (e) {
                        logger.warn({ e }, 'Falha envio aviso/ranking suporte');
                    }
                }
            }
            else {
                logger.warn('Canal de ranking não configurado para enviar aviso de reset.');
            }
            try {
                const jCh: any = await client.channels.fetch(journalismBackupChannelId).catch(() => null);
                if (jCh && jCh.isTextBased()) {
                    try {
                        const backupEmbed = new EmbedBuilder()
                            .setTitle('🗄️ Backup Área - Jornalismo')
                            .setDescription(`Registros: ${journalismData.count}. Backup gerado antes do reset.`)
                            .setColor(0xFFB6ED)
                            .setTimestamp();
                        const jsonFile = new AttachmentBuilder(journalismData.jsonBuffer, { name: `jornalismo-${Date.now()}.json` });
                        const csvFile = new AttachmentBuilder(journalismData.csvBuffer, { name: `jornalismo-${Date.now()}.csv` });
                        const files: any[] = [jsonFile, csvFile];
                        if (journalismPdf)
                            files.push({ attachment: journalismPdf, name: `jornalismo-${Date.now()}.pdf` });
                        await jCh.send({ embeds: [backupEmbed], files });
                    }
                    catch (e) {
                        logger.warn({ e }, 'Falha envio backup jornalismo');
                    }
                    const journalismResetEmbed = new EmbedBuilder()
                        .setTitle('♻️ Reset Semanal de Pontos')
                        .setDescription('A pontuação da equipe de **Jornalismo** foi resetada.')
                        .setColor(0xFFB6ED)
                        .setFooter({ text: 'Novo ciclo iniciado', iconURL: undefined })
                        .setTimestamp();
                    const journalismChannelId = (cfg as any).channels?.journalismRanking || journalismBackupChannelId;
                    const jRankCh: any = await client.channels.fetch(journalismChannelId).catch(() => null);
                    if (jRankCh && jRankCh.isTextBased()) {
                        await jRankCh.send({ embeds: [journalismResetEmbed] });
                        try {
                            const journalismRankingEmbed = await svc.buildRankingEmbedUnified('Jornalismo');
                            (journalismRankingEmbed as any).setColor && (journalismRankingEmbed as any).setColor(0xFFB6ED);
                            await jRankCh.send({ embeds: [journalismRankingEmbed] });
                        }
                        catch (e) {
                            logger.warn({ e }, 'Falha ao enviar ranking pós-reset jornalismo');
                        }
                    }
                }
            }
            catch (e) {
                logger.warn({ e }, 'Falha bloco backup/reset jornalismo');
            }
        }
        catch (err) {
            logger.error({ err }, 'Falha ao resetar suporte e jornalismo semanal');
        }
    }, { timezone: tz });
    cron.schedule('0 0 0 * * 6', async () => {
        const eventsChannelId = '1283495783328518144';
        const designChannelId = '1299517485149716480';
        const eventsBackupChannelId = '1287585553889624064';
        const designBackupChannelId = '1414440305935122434';
        const svc = new PointsService();
        logger.info('Executando reset semanal das áreas Eventos e Design');
        try {
            const evBackup = await exportAreaPoints('Eventos');
            let evPdf: Buffer | null = null;
            try {
                evPdf = await generateAreaPdf(client, 'Eventos');
            }
            catch (e) {
                logger.warn({ e }, 'Falha gerar PDF eventos');
            }
            const dBackup = await exportAreaPoints('Design');
            let dPdf: Buffer | null = null;
            try {
                dPdf = await generateAreaPdf(client, 'Design');
            }
            catch (e) {
                logger.warn({ e }, 'Falha gerar PDF design');
            }
            await resetAreaPoints('Eventos');
            await resetAreaPoints('Design');
            try {
                const evBackupCh: any = await client.channels.fetch(eventsBackupChannelId).catch(() => null);
                if (evBackupCh && evBackupCh.isTextBased()) {
                    try {
                        const backupEmbed = new EmbedBuilder()
                            .setTitle('🗄️ Backup Área - Eventos')
                            .setDescription(`Registros: ${evBackup.count}. Backup gerado antes do reset.`)
                            .setColor(0x9B59BB)
                            .setTimestamp();
                        const jsonFile = new AttachmentBuilder(evBackup.jsonBuffer, { name: `eventos-${Date.now()}.json` });
                        const csvFile = new AttachmentBuilder(evBackup.csvBuffer, { name: `eventos-${Date.now()}.csv` });
                        const files: any[] = [jsonFile, csvFile];
                        if (evPdf)
                            files.push({ attachment: evPdf, name: `eventos-${Date.now()}.pdf` });
                        await evBackupCh.send({ embeds: [backupEmbed], files });
                    }
                    catch (e) {
                        logger.warn({ e }, 'Falha envio backup eventos');
                    }
                }
                const evCh: any = await client.channels.fetch(eventsChannelId).catch(() => null);
                if (evCh && evCh.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('♻️ Reset Semanal de Pontos')
                        .setDescription('A pontuação da equipe de **Eventos** foi resetada.')
                        .setColor(0x9B59BB)
                        .setFooter({ text: 'Novo ciclo iniciado', iconURL: undefined })
                        .setTimestamp();
                    await evCh.send({ embeds: [embed] });
                    try {
                        const rankingEmbed = await svc.buildRankingEmbedUnified('Eventos');
                        (rankingEmbed as any).setColor && (rankingEmbed as any).setColor(0x9B59BB);
                        await evCh.send({ embeds: [rankingEmbed] });
                    }
                    catch (e) {
                        logger.warn({ e }, 'Falha ranking pós-reset eventos');
                    }
                }
            }
            catch (e) {
                logger.warn({ e }, 'Falha envio reset eventos');
            }
            try {
                const dBackupCh: any = await client.channels.fetch(designBackupChannelId).catch(() => null);
                if (dBackupCh && dBackupCh.isTextBased()) {
                    try {
                        const backupEmbed = new EmbedBuilder()
                            .setTitle('🗄️ Backup Área - Design')
                            .setDescription(`Registros: ${dBackup.count}. Backup gerado antes do reset.`)
                            .setColor(0xE67E22)
                            .setTimestamp();
                        const jsonFile = new AttachmentBuilder(dBackup.jsonBuffer, { name: `design-${Date.now()}.json` });
                        const csvFile = new AttachmentBuilder(dBackup.csvBuffer, { name: `design-${Date.now()}.csv` });
                        const files: any[] = [jsonFile, csvFile];
                        if (dPdf)
                            files.push({ attachment: dPdf, name: `design-${Date.now()}.pdf` });
                        await dBackupCh.send({ embeds: [backupEmbed], files });
                    }
                    catch (e) {
                        logger.warn({ e }, 'Falha envio backup design');
                    }
                }
                const dCh: any = await client.channels.fetch(designChannelId).catch(() => null);
                if (dCh && dCh.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('♻️ Reset Semanal de Pontos')
                        .setDescription('A pontuação da equipe de **Design** foi resetada.')
                        .setColor(0xE67E22)
                        .setFooter({ text: 'Novo ciclo iniciado', iconURL: undefined })
                        .setTimestamp();
                    await dCh.send({ embeds: [embed] });
                    try {
                        const rankingEmbed = await svc.buildRankingEmbedUnified('Design');
                        (rankingEmbed as any).setColor && (rankingEmbed as any).setColor(0xE67E22);
                        await dCh.send({ embeds: [rankingEmbed] });
                    }
                    catch (e) {
                        logger.warn({ e }, 'Falha ranking pós-reset design');
                    }
                }
            }
            catch (e) {
                logger.warn({ e }, 'Falha envio reset design');
            }
        }
        catch (err) {
            logger.error({ err }, 'Falha reset eventos/design');
        }
    }, { timezone: tz });
    cron.schedule('0 0 12 * * 6', async () => {
        const cfg = loadConfig();
        const recruitChannelId = (cfg as any).channels?.recruitRanking;
        const recruitBackupChannelId = '1414440076871598090';
        const svc = new PointsService();
        logger.info('Executando reset semanal da área Recrutamento');
        try {
            const rBackup = await exportAreaPoints('Recrutamento');
            let rPdf: Buffer | null = null;
            try {
                rPdf = await generateAreaPdf(client, 'Recrutamento');
            }
            catch (e) {
                logger.warn({ e }, 'Falha gerar PDF recrutamento');
            }
            await resetAreaPoints('Recrutamento');
            if (recruitChannelId) {
                try {
                    const backupCh: any = await client.channels.fetch(recruitBackupChannelId).catch(() => null);
                    if (backupCh && backupCh.isTextBased()) {
                        try {
                            const backupEmbed = new EmbedBuilder()
                                .setTitle('🗄️ Backup Área - Recrutamento')
                                .setDescription(`Registros: ${rBackup.count}. Backup gerado antes do reset.`)
                                .setColor(0x39ff14)
                                .setTimestamp();
                            const jsonFile = new AttachmentBuilder(rBackup.jsonBuffer, { name: `recrutamento-${Date.now()}.json` });
                            const csvFile = new AttachmentBuilder(rBackup.csvBuffer, { name: `recrutamento-${Date.now()}.csv` });
                            const files: any[] = [jsonFile, csvFile];
                            if (rPdf)
                                files.push({ attachment: rPdf, name: `recrutamento-${Date.now()}.pdf` });
                            await backupCh.send({ embeds: [backupEmbed], files });
                        }
                        catch (e) {
                            logger.warn({ e }, 'Falha envio backup recrutamento');
                        }
                    }
                    else {
                        logger.warn('Canal de backup recrutamento não acessível');
                    }
                    const rRankCh: any = await client.channels.fetch(recruitChannelId).catch(() => null);
                    if (rRankCh && rRankCh.isTextBased()) {
                        const embed = new EmbedBuilder()
                            .setTitle('♻️ Reset Semanal de Pontos')
                            .setDescription('A pontuação da equipe de **Recrutamento** foi resetada.')
                            .setColor(0x39ff14)
                            .setFooter({ text: 'Novo ciclo iniciado', iconURL: undefined })
                            .setTimestamp();
                        await rRankCh.send({ embeds: [embed] });
                        try {
                            const rankingEmbed = await svc.buildRankingEmbedUnified('Recrutamento');
                            await rRankCh.send({ embeds: [rankingEmbed] });
                        }
                        catch (e) {
                            logger.warn({ e }, 'Falha ranking pós-reset recrutamento');
                        }
                    }
                }
                catch (e) {
                    logger.warn({ e }, 'Falha envio reset recrutamento');
                }
            }
        }
        catch (err) {
            logger.error({ err }, 'Falha reset recrutamento');
        }
    }, { timezone: tz });
    cron.schedule('0 0 22 * * 5', async () => {
        try {
            const cfg: any = loadConfig();
            const supportCfg = cfg.support || {};
            const bancaCfg = cfg.banca || {};
            const avisoChannelId = supportCfg.channels?.bancaAviso || supportCfg.channels?.avisos;
            const supervisaoChannelId = bancaCfg.supervisionChannelId || supportCfg.channels?.supervisao;
            const normalBancaChannelId = supportCfg.channels?.bancaGeral || supportCfg.channels?.banca || supportCfg.channels?.bancaLog;
            const banner = 'https://images-ext-1.discordapp.net/external/tVleO-Npk159BUGqnUESgGzyGdJtIuAcXafwzpXu4hc/https/i.imgur.com/5IJQmH2.gif';
            const send = async (channelId?: string) => {
                if (!channelId)
                    return;
                const ch: any = await client.channels.fetch(channelId).catch(() => null);
                if (!ch || !ch.isTextBased())
                    return;
                const embed = new EmbedBuilder()
                    .setTitle('🗓️ Semana Encerrada')
                    .setDescription('Encerramos a semana das bancas de **Suporte**. Agradecemos o empenho de todos! Preparem-se para o novo ciclo.')
                    .setColor(0xFFFFFF)
                    .setImage(banner)
                    .setFooter({ text: 'Encerramento semanal • Suporte', iconURL: undefined })
                    .setTimestamp();
                try {
                    const cfgAny: any = cfg;
                    const movGuild = (cfgAny.areas || []).find((a: any) => a.name === 'MOVCALL')?.guildId;
                    if (movGuild && ch.guild?.id === movGuild) {
                        embed.setColor(0x8B0000);
                    }
                }
                catch { }
                await ch.send({ embeds: [embed] }).catch(() => { });
            };
            await Promise.all([
                send(avisoChannelId),
                send(supervisaoChannelId),
                send(normalBancaChannelId)
            ]);
        }
        catch (e) {
            logger.warn({ err: e }, 'Falha ao enviar encerramento semanal suporte');
        }
    }, { timezone: tz });
    cron.schedule('0 0 12 * * 6', async () => {
        try {
            const cfg: any = loadConfig();
            const recruitCfg = cfg.recruitBanca || {};
            const bancaChannelId = recruitCfg.pointsLogChannelId || cfg.channels?.recruitRanking || cfg.channels?.recruitLog;
            const banner = 'https://i.imgur.com/hnNwwY1.gif';
            if (bancaChannelId) {
                const ch: any = await client.channels.fetch(bancaChannelId).catch(() => null);
                if (ch && ch.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('🗓️ Semana Encerrada')
                        .setDescription('Encerramos a semana das bancas de **Recrutamento**. Obrigado pelo esforço! Novo ciclo começa agora.')
                        .setColor(0x39ff14)
                        .setImage(banner)
                        .setFooter({ text: 'Encerramento semanal • Recrutamento', iconURL: undefined })
                        .setTimestamp();
                    await ch.send({ embeds: [embed] }).catch(() => { });
                }
            }
        }
        catch (e) {
            logger.warn({ err: e }, 'Falha ao enviar encerramento semanal recrutamento');
        }
    }, { timezone: tz });
}
export default scheduleWeeklyTasks;
async function exportPoints() {
    const rows = await getAllPoints();
    const jsonBuffer = Buffer.from(JSON.stringify(rows, null, 2));
    const csvHeader = 'user_id,area,points,reports_count,shifts_count,last_updated';
    const csvLines = rows.map(r => [r.user_id, r.area, r.points, r.reports_count, r.shifts_count, r.last_updated || ''].join(','));
    const csvBuffer = Buffer.from([csvHeader, ...csvLines].join('\n'));
    const folder = process.env.BACKUP_DIR || './backups';
    fs.mkdirSync(folder, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(folder, `points-${ts}.json`), jsonBuffer);
    fs.writeFileSync(path.join(folder, `points-${ts}.csv`), csvBuffer);
    return { jsonBuffer, csvBuffer, count: rows.length };
}
async function exportAreaPoints(area: string) {
    const rows = await getAreaPoints(area);
    const jsonBuffer = Buffer.from(JSON.stringify(rows, null, 2));
    const csvHeader = 'user_id,area,points,reports_count,shifts_count,last_updated';
    const csvLines = rows.map(r => [r.user_id, r.area, r.points, r.reports_count, r.shifts_count, r.last_updated || ''].join(','));
    const csvBuffer = Buffer.from([csvHeader, ...csvLines].join('\n'));
    const folder = process.env.BACKUP_DIR || './backups';
    fs.mkdirSync(folder, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(folder, `points-${area.toLowerCase()}-${ts}.json`), jsonBuffer);
    fs.writeFileSync(path.join(folder, `points-${area.toLowerCase()}-${ts}.csv`), csvBuffer);
    return { jsonBuffer, csvBuffer, count: rows.length };
}
async function getAllPoints(): Promise<any[]> {
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        return new Promise<any[]>((resolve, reject) => {
            db.all('SELECT user_id, area, points, reports_count, shifts_count, last_updated FROM points', [], function (err: Error | null, rows: any[]) {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    const coll = DatabaseManager.getMongo().database.collection('points');
    return coll.find({}).toArray();
}
async function getAreaPoints(area: string): Promise<any[]> {
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        return new Promise<any[]>((resolve, reject) => {
            db.all('SELECT user_id, area, points, reports_count, shifts_count, last_updated FROM points WHERE area = ?', [area], function (err: Error | null, rows: any[]) {
                if (err)
                    reject(err);
                else
                    resolve(rows);
            });
        });
    }
    const coll = DatabaseManager.getMongo().database.collection('points');
    return coll.find({ area }).toArray();
}
async function resetPoints() {
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        await new Promise<void>((resolve, reject) => {
            db.run('UPDATE points SET points=0, reports_count=0, shifts_count=0, last_updated=CURRENT_TIMESTAMP', [], function (err: Error | null) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    else {
        const db = DatabaseManager.getMongo().database;
        await db.collection('points').updateMany({}, { $set: { points: 0, reports_count: 0, shifts_count: 0, last_updated: new Date().toISOString() } });
    }
}
async function resetSupportOnly() {
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        await new Promise<void>((resolve, reject) => {
            db.run('UPDATE points SET points=0, reports_count=0, shifts_count=0, last_updated=CURRENT_TIMESTAMP WHERE area = ?', ['Suporte'], function (err: Error | null) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    else {
        const db = DatabaseManager.getMongo().database;
        await db.collection('points').updateMany({ area: 'Suporte' }, { $set: { points: 0, reports_count: 0, shifts_count: 0, last_updated: new Date().toISOString() } });
    }
}
async function resetAreaPoints(area: string) {
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        await new Promise<void>((resolve, reject) => {
            db.run('UPDATE points SET points=0, reports_count=0, shifts_count=0, last_updated=CURRENT_TIMESTAMP WHERE area = ?', [area], function (err: Error | null) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    else {
        const db = DatabaseManager.getMongo().database;
        await db.collection('points').updateMany({ area }, { $set: { points: 0, reports_count: 0, shifts_count: 0, last_updated: new Date().toISOString() } });
    }
}
