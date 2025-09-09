import { BaseRepo } from './base.ts';
export interface UserRecord {
    id?: number | string;
    discord_id: string;
    username?: string;
    roles?: string[];
}
export class UserRepository extends BaseRepo {
    async upsert(discordId: string, username: string, roles: string[]) {
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO users (discord_id, username, roles) VALUES (?,?,?) ON CONFLICT(discord_id) DO UPDATE SET username=excluded.username, roles=excluded.roles, updated_at=CURRENT_TIMESTAMP', [discordId, username, JSON.stringify(roles)], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            await this.mongo.collection('users').updateOne({ discord_id: discordId }, { $set: { username, roles } }, { upsert: true });
        }
    }
}
