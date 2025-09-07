import cron from 'node-cron';
import { Client, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { DatabaseManager } from '../db/manager.ts';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/index.ts';
import { PointsService } from '../services/pointsService.ts';
import { generateAreaPdf } from '../utils/pdf.ts';
export function scheduleWeeklyTasks(client: Client) {
    const spec = process.env.POINTS_BACKUP_SCHEDULE || '0 0 22 * * 5';
    const tz = process.env.TIMEZONE || 'America/Sao_Paulo';
    cron.schedule(spec, async () => {
        logger.info('Running weekly points backup job');
        try {
            const data = await exportPoints();
            const { jsonBuffer, csvBuffer, count } = data;
            const channelId = process.env.BACKUP_CHANNEL_ID;
            if (channelId) {
                const ch = await client.channels.fetch(channelId).catch(() => null);
                if (ch && ch.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('🗄️ Backup Semanal')
                        .setDescription(`Backup concluído. Registros: ${count}. Reiniciando contadores.`)
                        .setColor(0x95a5a6)
                        .setTimestamp();
                    const jsonFile = new AttachmentBuilder(jsonBuffer, { name: `pontos-backup-${Date.now()}.json` });
                    const csvFile = new AttachmentBuilder(csvBuffer, { name: `pontos-backup-${Date.now()}.csv` });
                    await (ch as any).send({ embeds: [embed], files: [jsonFile, csvFile] });
                }
            }
            await resetPoints();
            logger.info('Weekly points reset completed');
        }
        catch (err) {
            logger.error({ err }, 'Weekly backup failed');
        }
    }, { timezone: tz });

    // Reset semanal específico de Suporte (sexta 22:00). Mesmo CRON acima já roda; porém se quiser isolar lógica de apenas suporte sem backup separado, pode manter unificado.
    // Caso queira independentemente da variável de ambiente, agendamos explicitamente.
    cron.schedule('0 0 22 * * 5', async () => {
        const cfg = loadConfig();
        const rankingChannelId = (cfg as any).support?.channels?.ranking || (cfg as any).channels?.ranking;
        const tzNow = new Date();
        logger.info('Executando reset semanal da área Suporte');
        const svc = new PointsService();
        try {
            await resetSupportOnly();
            if (rankingChannelId) {
                const ch: any = await client.channels.fetch(rankingChannelId).catch(()=>null);
                if (ch && ch.isTextBased()) {
                    const embed = new EmbedBuilder()
                        .setTitle('♻️ Reset Semanal de Pontos')
                        .setDescription('A pontuação da equipe de **Suporte** (incluindo relatórios e plantões) foi resetada.')
                        .setColor(0x5865F2)
                        .setFooter({ text: 'Novo ciclo iniciado' })
                        .setTimestamp();
                    await ch.send({ embeds:[embed] });
                    // PDF detalhado da área Suporte antes de enviar ranking (após reset valores = 0, se quiser pré-reset mover antes de reset)
                    try {
                        const pdfBuffer = await generateAreaPdf(client, 'Suporte');
                        await ch.send({ files: [{ attachment: pdfBuffer, name: `backup-suporte-${Date.now()}.pdf` }] });
                    } catch(e){ logger.warn({ e }, 'Falha ao gerar PDF suporte pós-reset'); }
                    // Opcional: enviar ranking zerado atualizado
                    try {
                        const rankingEmbed = await svc.buildRankingEmbedUnified('Suporte');
                        (rankingEmbed as any).setImage && (rankingEmbed as any).setImage('https://i.imgur.com/MaXRcNR.gif');
                        await ch.send({ embeds:[rankingEmbed] });
                    } catch(e){ logger.warn({ e }, 'Falha ao enviar ranking pós-reset'); }
                }
            } else {
                logger.warn('Canal de ranking não configurado para enviar aviso de reset.');
            }
        } catch(err){
            logger.error({ err }, 'Falha ao resetar suporte semanal');
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

// Reset apenas da área Suporte
async function resetSupportOnly(){
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        await new Promise<void>((resolve, reject) => {
            db.run('UPDATE points SET points=0, reports_count=0, shifts_count=0, last_updated=CURRENT_TIMESTAMP WHERE area = ?',[ 'Suporte' ], function(err:Error|null){ if(err) reject(err); else resolve(); });
        });
    } else {
        const db = DatabaseManager.getMongo().database;
        await db.collection('points').updateMany({ area: 'Suporte' }, { $set: { points:0, reports_count:0, shifts_count:0, last_updated: new Date().toISOString() } });
    }
}
