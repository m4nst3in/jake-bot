import { BaseRepo } from './base.js';
export interface PointsRecord {
    id?: number | string;
    user_id: string;
    area: string;
    points: number;
    reports_count: number;
    shifts_count: number;
    last_updated?: string;
}
export class PointRepository extends BaseRepo {
    async addPoints(userId: string, area: string, delta: number, reason: string, by: string) {
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO points (user_id, area, points, reports_count, shifts_count, last_updated) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id, area) DO UPDATE SET points=points+excluded.points, last_updated=CURRENT_TIMESTAMP', [userId, area, delta, 0, 0], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO point_logs (user_id, change, reason, by, timestamp) VALUES (?,?,?,?,CURRENT_TIMESTAMP)', [userId, delta, reason, by], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            await this.mongo.collection('points').updateOne({ user_id: userId, area }, { $inc: { points: delta }, $set: { last_updated: new Date().toISOString() } }, { upsert: true });
            await this.mongo.collection('point_logs').insertOne({ user_id: userId, change: delta, reason, by, timestamp: new Date().toISOString() });
        }
    }
    async getUserArea(userId: string, area: string): Promise<PointsRecord | null> {
        if (this.isSqlite()) {
            return new Promise<PointsRecord | null>((resolve, reject) => {
                this.sqlite.get('SELECT user_id, area, points, reports_count, shifts_count, last_updated FROM points WHERE user_id=? AND area=?', [userId, area], function (err: Error | null, row: any) {
                    if (err) reject(err); else resolve(row || null);
                });
            });
        }
        const doc = await this.mongo.collection('points').findOne({ user_id: userId, area });
        return doc as any || null;
    }
    async getTop(area: string, limit = 10) {
        if (this.isSqlite()) {
            return new Promise<any[]>((resolve, reject) => {
                this.sqlite.all('SELECT user_id, points, reports_count, shifts_count FROM points WHERE area=? ORDER BY points DESC LIMIT ?', [area, limit], function (err: Error | null, rows: any[]) {
                    if (err) reject(err); else resolve(rows);
                });
            });
        }
        return this.mongo.collection('points').find({ area }).project({ user_id:1, points:1, reports_count:1, shifts_count:1 }).sort({ points: -1 }).limit(limit).toArray();
    }
    async addPointsAndReport(userId: string, area: string, delta: number, reason: string, by: string){
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO points (user_id, area, points, reports_count, shifts_count, last_updated) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id, area) DO UPDATE SET points=points+excluded.points, reports_count=points.reports_count+1, last_updated=CURRENT_TIMESTAMP'.replace('points.reports_count','points.reports_count'), [userId, area, delta, 1, 0], function (err: Error | null) { if (err) reject(err); else resolve(); });
            });
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO point_logs (user_id, change, reason, by, timestamp) VALUES (?,?,?,?,CURRENT_TIMESTAMP)', [userId, delta, reason, by], function (err: Error | null) { if (err) reject(err); else resolve(); });
            });
        } else {
            await this.mongo.collection('points').updateOne({ user_id: userId, area }, { $inc: { points: delta, reports_count: 1 }, $set: { last_updated: new Date().toISOString() } }, { upsert: true });
            await this.mongo.collection('point_logs').insertOne({ user_id: userId, change: delta, reason, by, timestamp: new Date().toISOString() });
        }
    }
    async addShift(userId: string, area: string, delta: number, reason: string, by: string){
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO points (user_id, area, points, reports_count, shifts_count, last_updated) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id, area) DO UPDATE SET points=points+excluded.points, shifts_count=points.shifts_count+1, last_updated=CURRENT_TIMESTAMP'.replace('points.shifts_count','points.shifts_count'), [userId, area, delta, 0, 1], function (err: Error | null) { if (err) reject(err); else resolve(); });
            });
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO point_logs (user_id, change, reason, by, timestamp) VALUES (?,?,?,?,CURRENT_TIMESTAMP)', [userId, delta, reason, by], function (err: Error | null) { if (err) reject(err); else resolve(); });
            });
        } else {
            await this.mongo.collection('points').updateOne({ user_id: userId, area }, { $inc: { points: delta, shifts_count: 1 }, $set: { last_updated: new Date().toISOString() } }, { upsert: true });
            await this.mongo.collection('point_logs').insertOne({ user_id: userId, change: delta, reason, by, timestamp: new Date().toISOString() });
        }
    }
    async sumReports(area: string){
        if (this.isSqlite()) {
            return new Promise<number>((resolve, reject) => {
                this.sqlite.get('SELECT SUM(reports_count) t FROM points WHERE area=?', [area], function (err: Error | null, row: any) { if (err) reject(err); else resolve(row?.t || 0); });
            });
        }
        const agg = await this.mongo.collection('points').aggregate([{ $match:{ area } }, { $group:{ _id:null, t:{ $sum:'$reports_count' } } }]).toArray();
        return agg[0]?.t || 0;
    }
    async countArea(area: string) {
        if (this.isSqlite()) {
            return new Promise<number>((resolve, reject) => {
                this.sqlite.get('SELECT COUNT(*) c FROM points WHERE area=?', [area], function (err: Error | null, row: any) {
                    if (err) reject(err); else resolve(row?.c || 0);
                });
            });
        }
        return this.mongo.collection('points').countDocuments({ area });
    }
    async resetAllPoints(){
        if (this.isSqlite()) {
            await new Promise<void>((resolve,reject)=>{
                this.sqlite.run('UPDATE points SET points=0, reports_count=0, shifts_count=0, last_updated=CURRENT_TIMESTAMP', [], function(err:Error|null){ if(err) reject(err); else resolve(); });
            });
        } else {
            await this.mongo.collection('points').updateMany({}, { $set: { points:0, reports_count:0, shifts_count:0, last_updated: new Date().toISOString() } });
        }
    }
    async resetArea(area: string){
        if (this.isSqlite()) {
            await new Promise<void>((resolve,reject)=>{
                this.sqlite.run('UPDATE points SET points=0, reports_count=0, shifts_count=0, last_updated=CURRENT_TIMESTAMP WHERE area=?', [area], function(err:Error|null){ if(err) reject(err); else resolve(); });
            });
        } else {
            await this.mongo.collection('points').updateMany({ area }, { $set: { points:0, reports_count:0, shifts_count:0, last_updated: new Date().toISOString() } });
        }
    }
}
