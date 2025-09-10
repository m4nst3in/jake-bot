import sqlite3 from 'sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from '../../utils/logger.ts';
sqlite3.verbose();
export class SqliteAdapter {
    private db!: sqlite3.Database;
    constructor(private file: string) { }
    async connect(): Promise<void> {
        const dir = path.dirname(this.file);
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir, { recursive: true });
        await new Promise<void>((resolve, reject) => {
            this.db = new sqlite3.Database(this.file, (err) => {
                if (err)
                    return reject(err);
                resolve();
            });
        });
        logger.info({ file: this.file }, 'Conectei no sqlite');
        await this.migrate();
    }
    private run(sql: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    async migrate() {
        const stmts = [
            `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT UNIQUE, username TEXT, roles TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);`,
            `CREATE TABLE IF NOT EXISTS rpps (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, status TEXT, requested_at TEXT, processed_by TEXT, processed_at TEXT, reason TEXT);`,
            `ALTER TABLE rpps ADD COLUMN return_date TEXT;`,
            `CREATE TABLE IF NOT EXISTS points (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, area TEXT, points INTEGER DEFAULT 0, reports_count INTEGER DEFAULT 0, shifts_count INTEGER DEFAULT 0, last_updated TEXT);`,
            `CREATE TABLE IF NOT EXISTS point_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, change INTEGER, reason TEXT, by TEXT, timestamp TEXT);`,
            `CREATE TABLE IF NOT EXISTS blacklist (id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT, reason TEXT, area_or_global TEXT, added_by TEXT, added_at TEXT, removed_by TEXT, removed_at TEXT);`,
            `CREATE TABLE IF NOT EXISTS occurrences (id INTEGER PRIMARY KEY AUTOINCREMENT, staff_id TEXT, motivo1 TEXT, motivo2 TEXT, resolucao TEXT, created_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`,
            `CREATE TABLE IF NOT EXISTS role_transfers (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user TEXT, to_user TEXT, roles TEXT, by TEXT, timestamp TEXT);`,
            `CREATE TABLE IF NOT EXISTS audits (id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT, payload TEXT, by TEXT, timestamp TEXT);`,
            `CREATE TABLE IF NOT EXISTS config (guild_id TEXT PRIMARY KEY, area_settings TEXT, roles_config TEXT, channels_config TEXT);`,
            `CREATE TABLE IF NOT EXISTS bancas (id INTEGER PRIMARY KEY AUTOINCREMENT, channel_id TEXT UNIQUE, name TEXT, staff_id TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);`,
            `CREATE TABLE IF NOT EXISTS staff_members (id INTEGER PRIMARY KEY AUTOINCREMENT, discord_id TEXT UNIQUE, added_at TEXT DEFAULT CURRENT_TIMESTAMP);`,
            `ALTER TABLE staff_members ADD COLUMN rank_role_id TEXT;`,
            `CREATE UNIQUE INDEX IF NOT EXISTS ux_staff_members_discord ON staff_members(discord_id);`,
            `CREATE TABLE IF NOT EXISTS rpp_role_snapshots (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT UNIQUE, roles TEXT, stored_at TEXT DEFAULT CURRENT_TIMESTAMP);`
        ];
        for (const stmt of stmts) {
            if (stmt.startsWith('ALTER TABLE')) {
                try {
                    await this.run(stmt);
                }
                catch { }
            }
            else {
                await this.run(stmt);
            }
        }
        await new Promise<void>((resolve) => {
            this.db.all('SELECT user_id, area, COUNT(*) c FROM points GROUP BY user_id, area HAVING c>1', [], async (err, rows: any[]) => {
                if (err || !rows?.length)
                    return resolve();
                for (const r of rows as any[]) {
                    await new Promise<void>((res2) => {
                        this.db.all('SELECT id, points, reports_count, shifts_count, last_updated FROM points WHERE user_id=? AND area=?', [r.user_id, r.area], async (err2, recs: any[]) => {
                            if (err2 || !recs?.length)
                                return res2();
                            const keep: any = recs[0];
                            const others: any[] = recs.slice(1);
                            const totalPoints = recs.reduce((a: number, b: any) => a + (b.points || 0), 0);
                            const totalReports = recs.reduce((a: number, b: any) => a + (b.reports_count || 0), 0);
                            const totalShifts = recs.reduce((a: number, b: any) => a + (b.shifts_count || 0), 0);
                            const lastUpdated = recs.map((x: any) => x.last_updated || '').sort().pop();
                            await this.run('UPDATE points SET points=?, reports_count=?, shifts_count=?, last_updated=? WHERE id=?', [totalPoints, totalReports, totalShifts, lastUpdated, keep.id]);
                            if (others.length) {
                                const ids = others.map((o: any) => o.id);
                                await this.run(`DELETE FROM points WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
                            }
                            res2();
                        });
                    });
                }
                resolve();
            });
        });
        await this.run(`CREATE UNIQUE INDEX IF NOT EXISTS ux_points_user_area ON points(user_id, area);`);
    }
    get connection() { return this.db; }
}
