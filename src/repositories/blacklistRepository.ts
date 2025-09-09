import { BaseRepo } from './base.js';
export interface BlacklistRecord {
    id?: number | string;
    discord_id: string;
    reason: string;
    area_or_global: string;
    added_by: string;
    added_at?: string;
    removed_by?: string;
    removed_at?: string;
}
export class BlacklistRepository extends BaseRepo {
    async add(rec: Omit<BlacklistRecord, 'id' | 'added_at'>) {
        const area = (rec.area_or_global || '').trim().toUpperCase();
        const record = { ...rec, area_or_global: area };
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO blacklist (discord_id, reason, area_or_global, added_by, added_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)', [record.discord_id, record.reason, record.area_or_global, record.added_by], function (err: Error | null) {
                    if (err) reject(err); else resolve();
                });
            });
        } else {
            await this.mongo.collection('blacklist').insertOne({ ...record, added_at: new Date().toISOString() });
        }
    }
    async remove(discordId: string, areaOrGlobal: string, by: string) {
        const area = (areaOrGlobal || '').trim().toUpperCase();
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('UPDATE blacklist SET removed_by=?, removed_at=CURRENT_TIMESTAMP WHERE discord_id=? AND UPPER(area_or_global)=? AND removed_at IS NULL', [by, discordId, area], function (err: Error | null) {
                    if (err) reject(err); else resolve();
                });
            });
        } else {
            await this.mongo.collection('blacklist').updateOne({ discord_id: discordId, area_or_global: area, removed_at: { $exists: false } }, { $set: { removed_by: by, removed_at: new Date().toISOString() } });
        }
    }
    async isBlacklisted(discordId: string, areaOrGlobal: string) {
        const area = (areaOrGlobal || '').trim().toUpperCase();
        if (this.isSqlite()) {
            return new Promise<boolean>((resolve, reject) => {
                this.sqlite.get('SELECT 1 FROM blacklist WHERE discord_id=? AND UPPER(area_or_global)=? AND removed_at IS NULL', [discordId, area], function (err: Error | null, row: any) {
                    if (err) reject(err); else resolve(!!row);
                });
            });
        }
        const doc = await this.mongo.collection('blacklist').findOne({ discord_id: discordId, area_or_global: area, removed_at: { $exists: false } });
        if (doc) return true;
        // fallback case-insensitive (se houver dados antigos em minúsculo)
        const legacy = await this.mongo.collection('blacklist').findOne({ discord_id: discordId, removed_at: { $exists: false }, area_or_global: new RegExp(`^${area}$`, 'i') });
        return !!legacy;
    }
    async listUserActive(discordId: string) {
        if (this.isSqlite()) {
            return await new Promise<any[]>((resolve, reject) => {
                this.sqlite.all('SELECT * FROM blacklist WHERE discord_id=? AND removed_at IS NULL ORDER BY added_at DESC', [discordId], function (err: Error | null, rows: any[]) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows);
                });
            });
        }
        else {
            return await this.mongo.collection('blacklist').find({ discord_id: discordId, removed_at: { $exists: false } }).sort({ added_at: -1 }).toArray();
        }
    }
    async list(areaOrGlobal: string) {
        if (this.isSqlite()) {
            return new Promise<any[]>((resolve, reject) => {
                this.sqlite.all('SELECT discord_id, reason, added_at FROM blacklist WHERE area_or_global=? AND removed_at IS NULL', [areaOrGlobal], function (err: Error | null, rows: any[]) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows);
                });
            });
        }
        return this.mongo.collection('blacklist').find({ area_or_global: areaOrGlobal, removed_at: { $exists: false } }).toArray();
    }
    async resetAll() {
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('UPDATE blacklist SET removed_by="RESET", removed_at=CURRENT_TIMESTAMP WHERE removed_at IS NULL', function (err: Error | null) {
                    if (err) reject(err); else resolve();
                });
            });
        } else {
            await this.mongo.collection('blacklist').updateMany({ removed_at: { $exists: false } }, { $set: { removed_by: 'RESET', removed_at: new Date().toISOString() } });
        }
    }
    async resetArea(area: string) {
        const areaUpper = (area || '').trim().toUpperCase();
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('UPDATE blacklist SET removed_by="RESET", removed_at=CURRENT_TIMESTAMP WHERE removed_at IS NULL AND UPPER(area_or_global)=?', [areaUpper], function (err: Error | null) {
                    if (err) reject(err); else resolve();
                });
            });
        } else {
            await this.mongo.collection('blacklist').updateMany({ area_or_global: areaUpper, removed_at: { $exists: false } }, { $set: { removed_by: 'RESET', removed_at: new Date().toISOString() } });
        }
    }
}
