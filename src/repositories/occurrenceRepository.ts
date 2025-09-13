import { BaseRepo } from './base.ts';
export interface OccurrenceRecord {
    id?: number | string;
    staff_id: string;
    motivo1: string;
    motivo2?: string;
    resolucao: string;
    created_by: string;
    created_at?: string;
}
export class OccurrenceRepository extends BaseRepo {
    async add(rec: Omit<OccurrenceRecord, 'id' | 'created_at'>) {
        if (this.isSqlite()) {
            await new Promise<void>((resolve, reject) => {
                this.sqlite.run('INSERT INTO occurrences (staff_id, motivo1, motivo2, resolucao, created_by, created_at) VALUES (?,?,?,?,?,CURRENT_TIMESTAMP)', [rec.staff_id, rec.motivo1, rec.motivo2 || null, rec.resolucao, rec.created_by], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            await this.mongo.collection('occurrences').insertOne({ ...rec, created_at: new Date().toISOString() });
        }
    }
    async countForUser(staffId: string) {
        if (this.isSqlite()) {
            return await new Promise<number>((resolve, reject) => {
                this.sqlite.get('SELECT COUNT(*) c FROM occurrences WHERE staff_id=?', [staffId], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.c || 0);
                });
            });
        }
        return await this.mongo.collection('occurrences').countDocuments({ staff_id: staffId });
    }
    async listRecentForUser(staffId: string, limit = 5) {
        if (this.isSqlite()) {
            return await new Promise<any[]>((resolve, reject) => {
                this.sqlite.all('SELECT * FROM occurrences WHERE staff_id=? ORDER BY created_at DESC LIMIT ?', [staffId, limit], function (err: Error | null, rows: any[]) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows || []);
                });
            });
        }
        return await this.mongo
            .collection('occurrences')
            .find({ staff_id: staffId })
            .sort({ created_at: -1 })
            .limit(limit)
            .toArray();
    }
}
