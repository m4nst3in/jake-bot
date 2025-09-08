import { BaseRepo } from './base.js';
export class BancaRepository extends BaseRepo {
    async create(channelId: string, name: string, staffId: string) {
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO bancas (channel_id,name,staff_id,created_at) VALUES (?,?,?,CURRENT_TIMESTAMP)', [channelId, name, staffId], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            await this.mongo.collection('bancas').insertOne({ channel_id: channelId, name, staff_id: staffId, created_at: new Date().toISOString() });
        }
    }
    async getByChannel(channelId: string) {
        if (this.isSqlite()) {
            return await new Promise<any | null>((resolve, reject) => {
                this.sqlite.get('SELECT * FROM bancas WHERE channel_id=?', [channelId], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row || null);
                });
            });
        }
        return await this.mongo.collection('bancas').findOne({ channel_id: channelId });
    }
}
