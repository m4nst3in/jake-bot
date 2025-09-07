import { MongoClient, Db } from 'mongodb';
import { logger } from '../../utils/logger.ts';
export class MongoAdapter {
    private client!: MongoClient;
    private db!: Db;
    constructor(private uri: string) { }
    async connect() {
        this.client = new MongoClient(this.uri);
        await this.client.connect();
        this.db = this.client.db();
        logger.info('Ei mongol, conectei no mongodb, pdc?');
        await this.ensureIndexes();
    }
    private async ensureIndexes() {
        await this.db.collection('users').createIndex({ discord_id: 1 }, { unique: true });
        await this.db.collection('rpps').createIndex({ user_id: 1 });
        await this.db.collection('points').createIndex({ user_id: 1, area: 1 }, { unique: true });
        await this.db.collection('blacklist').createIndex({ discord_id: 1 });
    }
    get database() { return this.db; }
}
