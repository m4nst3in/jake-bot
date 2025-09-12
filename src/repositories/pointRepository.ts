import { BaseRepo } from './base.ts';
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
                    if (err)
                        reject(err);
                    else
                        resolve(row || null);
                });
            });
        }
        const doc = await this.mongo.collection('points').findOne({ user_id: userId, area });
        return doc as any || null;
    }
    async getTop(area: string, limit = 10) {
        if (this.isSqlite()) {
            return new Promise<PointsRecord[]>((resolve, reject) => {
                this.sqlite.all('SELECT user_id, area, points, reports_count, shifts_count, last_updated FROM points WHERE area=? ORDER BY points DESC LIMIT ?', [area, limit], function (err: Error | null, rows: any[]) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
        }
        const cursor = this.mongo.collection('points').find({ area }).sort({ points: -1 }).limit(limit);
        return cursor.toArray() as any;
    }

    async getDailyPointsThisWeek(userId: string): Promise<number[]> {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Domingo da semana atual
        startOfWeek.setHours(0, 0, 0, 0);

        const dailyPoints = new Array(7).fill(0);

        if (this.isSqlite()) {
            return new Promise<number[]>((resolve, reject) => {
                const sevenDaysAgo = new Date(startOfWeek);
                const query = `
                    SELECT DATE(timestamp) as date, SUM(change) as total_points
                    FROM point_logs 
                    WHERE user_id = ? AND change > 0 AND timestamp >= ?
                    GROUP BY DATE(timestamp)
                    ORDER BY DATE(timestamp)
                `;
                
                this.sqlite.all(query, [userId, sevenDaysAgo.toISOString()], (err: Error | null, rows: any[]) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    
                    for (const row of rows) {
                        const logDate = new Date(row.date);
                        const dayOfWeek = logDate.getDay(); // 0 = Domingo, 6 = Sábado
                        dailyPoints[dayOfWeek] = row.total_points || 0;
                    }
                    
                    resolve(dailyPoints);
                });
            });
        } else {
            // MongoDB implementation
            const sevenDaysAgo = startOfWeek.toISOString();
            const pipeline = [
                {
                    $match: {
                        user_id: userId,
                        change: { $gt: 0 },
                        timestamp: { $gte: sevenDaysAgo }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: { $dateFromString: { dateString: "$timestamp" } } } },
                        total_points: { $sum: "$change" }
                    }
                }
            ];
            
            const results = await this.mongo.collection('point_logs').aggregate(pipeline).toArray();
            
            for (const result of results) {
                const logDate = new Date(result._id);
                const dayOfWeek = logDate.getDay();
                dailyPoints[dayOfWeek] = result.total_points || 0;
            }
            
            return dailyPoints;
        }
    }

    async getWeeklyStats(userId: string, weeksCount: number): Promise<Array<{week: number, startDate: Date, endDate: Date, points: number, reports: number, shifts: number}>> {
        const stats: Array<{week: number, startDate: Date, endDate: Date, points: number, reports: number, shifts: number}> = [];
        
        for (let i = 0; i < weeksCount; i++) {
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - (now.getDay() + (i * 7))); // Domingo da semana
            weekStart.setHours(0, 0, 0, 0);
            
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            weekEnd.setHours(23, 59, 59, 999);

            let points = 0;
            let reports = 0;
            let shifts = 0;

            if (this.isSqlite()) {
                const weekStats = await new Promise<{points: number, reports: number, shifts: number}>((resolve, reject) => {
                    this.sqlite.get(`
                        SELECT 
                            COALESCE(SUM(CASE WHEN change > 0 THEN change ELSE 0 END), 0) as points,
                            COALESCE(SUM(CASE WHEN reason LIKE '%relatório%' OR reason LIKE '%relatorio%' THEN 1 ELSE 0 END), 0) as reports,
                            COALESCE(SUM(CASE WHEN reason LIKE '%plantão%' OR reason LIKE '%plantao%' THEN 1 ELSE 0 END), 0) as shifts
                        FROM point_logs 
                        WHERE user_id = ? AND timestamp BETWEEN ? AND ?
                    `, [userId, weekStart.toISOString(), weekEnd.toISOString()], (err: Error | null, row: any) => {
                        if (err) reject(err);
                        else resolve(row || {points: 0, reports: 0, shifts: 0});
                    });
                });
                
                points = weekStats.points;
                reports = weekStats.reports;
                shifts = weekStats.shifts;
            } else {
                // MongoDB implementation
                const pipeline = [
                    {
                        $match: {
                            user_id: userId,
                            timestamp: {
                                $gte: weekStart.toISOString(),
                                $lte: weekEnd.toISOString()
                            }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            points: { $sum: { $cond: [{ $gt: ["$change", 0] }, "$change", 0] } },
                            reports: { 
                                $sum: { 
                                    $cond: [
                                        { $or: [
                                            { $regexMatch: { input: "$reason", regex: /relatório/i } },
                                            { $regexMatch: { input: "$reason", regex: /relatorio/i } }
                                        ]}, 
                                        1, 
                                        0
                                    ] 
                                }
                            },
                            shifts: { 
                                $sum: { 
                                    $cond: [
                                        { $or: [
                                            { $regexMatch: { input: "$reason", regex: /plantão/i } },
                                            { $regexMatch: { input: "$reason", regex: /plantao/i } }
                                        ]}, 
                                        1, 
                                        0
                                    ] 
                                }
                            }
                        }
                    }
                ];
                
                const result = await this.mongo.collection('point_logs').aggregate(pipeline).toArray();
                if (result.length > 0) {
                    points = result[0].points || 0;
                    reports = result[0].reports || 0;
                    shifts = result[0].shifts || 0;
                }
            }

            stats.push({
                week: i,
                startDate: weekStart,
                endDate: weekEnd,
                points,
                reports,
                shifts
            });
        }

        return stats;
    }
        if (this.isSqlite()) {
            return new Promise<any[]>((resolve, reject) => {
                this.sqlite.all('SELECT user_id, points, reports_count, shifts_count FROM points WHERE area=? ORDER BY points DESC LIMIT ?', [area, limit], function (err: Error | null, rows: any[]) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows);
                });
            });
        }
        return this.mongo.collection('points').find({ area }).project({ user_id: 1, points: 1, reports_count: 1, shifts_count: 1 }).sort({ points: -1 }).limit(limit).toArray();
    }
    async addPointsAndReport(userId: string, area: string, delta: number, reason: string, by: string) {
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO points (user_id, area, points, reports_count, shifts_count, last_updated) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id, area) DO UPDATE SET points=points+excluded.points, reports_count=points.reports_count+1, last_updated=CURRENT_TIMESTAMP'.replace('points.reports_count', 'points.reports_count'), [userId, area, delta, 1, 0], function (err: Error | null) {
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
            await this.mongo.collection('points').updateOne({ user_id: userId, area }, { $inc: { points: delta, reports_count: 1 }, $set: { last_updated: new Date().toISOString() } }, { upsert: true });
            await this.mongo.collection('point_logs').insertOne({ user_id: userId, change: delta, reason, by, timestamp: new Date().toISOString() });
        }
    }
    async addShift(userId: string, area: string, delta: number, reason: string, by: string) {
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO points (user_id, area, points, reports_count, shifts_count, last_updated) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id, area) DO UPDATE SET points=points+excluded.points, shifts_count=points.shifts_count+1, last_updated=CURRENT_TIMESTAMP'.replace('points.shifts_count', 'points.shifts_count'), [userId, area, delta, 0, 1], function (err: Error | null) {
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
            await this.mongo.collection('points').updateOne({ user_id: userId, area }, { $inc: { points: delta, shifts_count: 1 }, $set: { last_updated: new Date().toISOString() } }, { upsert: true });
            await this.mongo.collection('point_logs').insertOne({ user_id: userId, change: delta, reason, by, timestamp: new Date().toISOString() });
        }
    }
    async sumReports(area: string) {
        if (this.isSqlite()) {
            return new Promise<number>((resolve, reject) => {
                this.sqlite.get('SELECT SUM(reports_count) t FROM points WHERE area=?', [area], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.t || 0);
                });
            });
        }
        const agg = await this.mongo.collection('points').aggregate([{ $match: { area } }, { $group: { _id: null, t: { $sum: '$reports_count' } } }]).toArray();
        return agg[0]?.t || 0;
    }
    async countArea(area: string) {
        if (this.isSqlite()) {
            return new Promise<number>((resolve, reject) => {
                this.sqlite.get('SELECT COUNT(*) c FROM points WHERE area=?', [area], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.c || 0);
                });
            });
        }
        return this.mongo.collection('points').countDocuments({ area });
    }
    async resetAllPoints() {
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('UPDATE points SET points=0, reports_count=0, shifts_count=0, last_updated=CURRENT_TIMESTAMP', [], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            await this.mongo.collection('points').updateMany({}, { $set: { points: 0, reports_count: 0, shifts_count: 0, last_updated: new Date().toISOString() } });
        }
    }
    async resetArea(area: string) {
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('UPDATE points SET points=0, reports_count=0, shifts_count=0, last_updated=CURRENT_TIMESTAMP WHERE area=?', [area], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            await this.mongo.collection('points').updateMany({ area }, { $set: { points: 0, reports_count: 0, shifts_count: 0, last_updated: new Date().toISOString() } });
        }
    }
    async getUserAllAreas(userId: string) {
        if (this.isSqlite()) {
            return new Promise<any[]>((resolve, reject) => {
                this.sqlite.all('SELECT area, points, reports_count, shifts_count FROM points WHERE user_id=?', [userId], function (err: Error | null, rows: any[]) {
                    if (err) reject(err); else resolve(rows || []);
                });
            });
        }
        return this.mongo.collection('points').find({ user_id: userId }).project({ area: 1, points: 1, reports_count: 1, shifts_count: 1 }).toArray();
    }
    async countDistinctUsers() {
        if (this.isSqlite()) {
            return new Promise<number>((resolve, reject) => {
                this.sqlite.get('SELECT COUNT(DISTINCT user_id) c FROM points', [], function (err: Error | null, row: any) {
                    if (err) reject(err); else resolve(row?.c || 0);
                });
            });
        }
        const distinct = await this.mongo.collection('points').distinct('user_id');
        return distinct.length;
    }
    async getAreaPosition(userId: string, area: string) {
        if (this.isSqlite()) {
            return new Promise<number | null>((resolve, reject) => {
                this.sqlite.get('SELECT points FROM points WHERE user_id=? AND area=?', [userId, area], (err: Error | null, row: any) => {
                    if (err) return reject(err);
                    if (!row) return resolve(null);
                    const userPts = row.points || 0;
                    this.sqlite.get('SELECT COUNT(*) c FROM points WHERE area=? AND points > ?', [area, userPts], (err2: Error | null, row2: any) => {
                        if (err2) return reject(err2);
                        resolve((row2?.c || 0) + 1);
                    });
                });
            });
        }
        const doc = await this.mongo.collection('points').findOne({ user_id: userId, area });
        if (!doc) return null;
        const userPts = doc.points || 0;
        const ahead = await this.mongo.collection('points').countDocuments({ area, points: { $gt: userPts } });
        return ahead + 1;
    }
}
