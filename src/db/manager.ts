import { SqliteAdapter } from './sqlite/adapter.ts';
import { MongoAdapter } from './mongo/adapter.ts';
import { logger } from '../utils/logger.ts';
export type DBType = 'sqlite' | 'mongo';
export class DatabaseManager {
    private static sqlite: SqliteAdapter;
    private static mongo: MongoAdapter;
    static current: DBType = 'sqlite';
    static async init() {
        const selected = process.env.DB_TYPE as DBType || 'sqlite';
        this.current = selected;
        if (selected === 'sqlite') {
            this.sqlite = new SqliteAdapter(process.env.SQLITE_FILE || './data/jake.db');
            await this.sqlite.connect();
        }
        else {
            this.mongo = new MongoAdapter(process.env.MONGO_URI || 'mongodb://localhost:27017/jake');
            await this.mongo.connect();
        }
        logger.info({ db: selected }, 'Database initialized');
    }
    static getSqlite() { return this.sqlite; }
    static getMongo() { return this.mongo; }
}
