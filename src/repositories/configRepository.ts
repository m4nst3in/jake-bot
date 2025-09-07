import { BaseRepo } from './base.js';
export interface ConfigRecord {
    guild_id: string;
    area_settings?: any;
    roles_config?: any;
    channels_config?: any;
}
export class ConfigRepository extends BaseRepo {
    async get(guildId: string): Promise<ConfigRecord | null> {
        if (this.isSqlite()) {
            return new Promise<any>((resolve, reject) => {
                this.sqlite.get('SELECT * FROM config WHERE guild_id=?', [guildId], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row ? { ...row, area_settings: row.area_settings && JSON.parse(row.area_settings), roles_config: row.roles_config && JSON.parse(row.roles_config), channels_config: row.channels_config && JSON.parse(row.channels_config) } : null);
                });
            });
        }
        const doc = await this.mongo.collection('config').findOne({ guild_id: guildId });
        return doc as any;
    }
    private async ensure(guildId: string): Promise<ConfigRecord> {
        const existing = await this.get(guildId);
        if (existing)
            return existing;
        const empty: ConfigRecord = { guild_id: guildId, roles_config: {}, channels_config: {}, area_settings: {} };
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO config (guild_id, area_settings, roles_config, channels_config) VALUES (?,?,?,?)', [guildId, JSON.stringify({}), JSON.stringify({}), JSON.stringify({})], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            await this.mongo.collection('config').insertOne(empty as any);
        }
        return empty;
    }
    async setChannel(guildId: string, key: string, channelId: string) {
        const current = await this.ensure(guildId);
        const channels = { ...(current.channels_config || {}), [key]: channelId };
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('UPDATE config SET channels_config=? WHERE guild_id=?', [JSON.stringify(channels), guildId], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            await this.mongo.collection('config').updateOne({ guild_id: guildId }, { $set: { channels_config: channels } });
        }
    }
    async setRole(guildId: string, key: string, roleId: string) {
        const current = await this.ensure(guildId);
        const roles = { ...(current.roles_config || {}), [key]: roleId };
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('UPDATE config SET roles_config=? WHERE guild_id=?', [JSON.stringify(roles), guildId], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            await this.mongo.collection('config').updateOne({ guild_id: guildId }, { $set: { roles_config: roles } });
        }
    }
}
