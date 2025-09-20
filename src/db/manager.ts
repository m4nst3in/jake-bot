import { SqliteAdapter, SqliteSchema } from './sqlite/adapter.ts';
import { MongoAdapter } from './mongo/adapter.ts';
import { logger } from '../utils/logger.ts';
export type DBType = 'sqlite' | 'mongo';
export class DatabaseManager {
    private static sqliteCore: SqliteAdapter;
    private static sqlitePoints: SqliteAdapter;
    private static sqliteBlacklist: SqliteAdapter;
    private static sqliteRpp: SqliteAdapter;
    private static mongo: MongoAdapter;
    static current: DBType = 'sqlite';
    static async init() {
        const selected = process.env.DB_TYPE as DBType || 'sqlite';
        this.current = selected;
        if (selected === 'sqlite') {
            const coreFile = process.env.SQLITE_CORE_FILE || process.env.SQLITE_FILE || './data/core.db';
            const pointsFile = process.env.SQLITE_POINTS_FILE || './data/points.db';
            const blacklistFile = process.env.SQLITE_BLACKLIST_FILE || './data/blacklist.db';
            const rppFile = process.env.SQLITE_RPP_FILE || './data/rpp.db';
            this.sqliteCore = new SqliteAdapter(coreFile, 'core');
            this.sqlitePoints = new SqliteAdapter(pointsFile, 'points');
            this.sqliteBlacklist = new SqliteAdapter(blacklistFile, 'blacklist');
            this.sqliteRpp = new SqliteAdapter(rppFile, 'rpp');
            await this.sqliteCore.connect();
            await this.sqlitePoints.connect();
            await this.sqliteBlacklist.connect();
            await this.sqliteRpp.connect();
        }
        else {
            this.mongo = new MongoAdapter(process.env.MONGO_URI || 'mongodb://localhost:27017/jake');
            await this.mongo.connect();
        }
        logger.info({ db: selected }, 'Inicializei a db');
    }
    static getSqlite(schema: SqliteSchema = 'core') {
        switch (schema) {
            case 'core': return this.sqliteCore;
            case 'points': return this.sqlitePoints;
            case 'blacklist': return this.sqliteBlacklist;
            case 'rpp': return this.sqliteRpp;
            default: return this.sqliteCore;
        }
    }
    static getMongo() { return this.mongo; }
}
