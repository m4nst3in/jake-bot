import { DatabaseManager } from '../db/manager.ts';
export interface RPPRecord {
    id?: number | string;
    user_id: number | string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'REMOVED';
    requested_at: string;
    processed_by?: string;
    processed_at?: string;
    reason?: string;
    return_date?: string;
}
export class RPPRepository {
    async clearAll() {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            await new Promise<void>((resolve, reject) => {
                db.run('DELETE FROM rpps', [], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            await db.collection('rpps').deleteMany({});
        }
    }
    async create(data: Omit<RPPRecord, 'id'>): Promise<RPPRecord> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            const id = await new Promise<number>((resolve, reject) => {
                db.run('INSERT INTO rpps (user_id,status,requested_at,processed_by,processed_at,reason,return_date) VALUES (?,?,?,?,?,?,?)', [data.user_id, data.status, data.requested_at, data.processed_by, data.processed_at, data.reason, data.return_date], function (this: any, err: Error | null) {
                    if (err)
                        return reject(err);
                    resolve(this.lastID as number);
                });
            });
            return { id, ...data };
        }
        else {
            const db = DatabaseManager.getMongo().database;
            const doc = { ...data };
            const result = await db.collection('rpps').insertOne(doc as any);
            return { id: result.insertedId.toString(), ...data };
        }
    }
    async updateStatus(id: number | string, status: RPPRecord['status'], processed_by: string): Promise<void> {
        const processed_at = new Date().toISOString();
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE rpps SET status=?, processed_by=?, processed_at=? WHERE id=?', [status, processed_by, processed_at, id], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            const { ObjectId } = await import('mongodb');
            let objectId: any;
            try {
                objectId = new ObjectId(id as any);
            }
            catch {
                objectId = id;
            }
            await db.collection('rpps').updateOne({ _id: objectId } as any, { $set: { status, processed_by, processed_at } });
        }
    }
    async listPending(limit = 20): Promise<RPPRecord[]> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            return new Promise<RPPRecord[]>((resolve, reject) => {
                db.all('SELECT * FROM rpps WHERE status="PENDING" ORDER BY requested_at ASC LIMIT ?', [limit], function (err: Error | null, rows: any[]) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows as RPPRecord[]);
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            const docs = await db.collection('rpps').find({ status: 'PENDING' }).sort({ requested_at: 1 }).limit(limit).toArray();
            return docs as any;
        }
    }
    async findPendingByUser(userId: string): Promise<RPPRecord | null> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            return new Promise<RPPRecord | null>((resolve, reject) => {
                db.get('SELECT * FROM rpps WHERE user_id=? AND status="PENDING" ORDER BY requested_at DESC LIMIT 1', [userId], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row || null);
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            const doc = await db.collection('rpps').findOne({ user_id: userId, status: 'PENDING' }, { sort: { requested_at: -1 } });
            return doc as any || null;
        }
    }
    async listActive(guildFilterUserIds?: string[]): Promise<RPPRecord[]> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            const query = guildFilterUserIds && guildFilterUserIds.length ? `SELECT * FROM rpps WHERE status="ACCEPTED" AND user_id IN (${guildFilterUserIds.map(() => '?').join(',')})` : 'SELECT * FROM rpps WHERE status="ACCEPTED"';
            return new Promise<RPPRecord[]>((resolve, reject) => {
                db.all(query, guildFilterUserIds || [], function (err: Error | null, rows: any[]) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows as RPPRecord[]);
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            const filter: any = { status: 'ACCEPTED' };
            if (guildFilterUserIds && guildFilterUserIds.length)
                filter.user_id = { $in: guildFilterUserIds };
            return await db.collection('rpps').find(filter).toArray() as any;
        }
    }
    async findActiveByUser(userId: string): Promise<RPPRecord | null> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            return new Promise<RPPRecord | null>((resolve, reject) => {
                db.get('SELECT * FROM rpps WHERE user_id=? AND status="ACCEPTED" ORDER BY processed_at DESC LIMIT 1', [userId], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row || null);
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            const doc = await db.collection('rpps').findOne({ user_id: userId, status: 'ACCEPTED' }, { sort: { processed_at: -1 } });
            return doc as any || null;
        }
    }
    async markRemoved(userId: string, moderatorId: string) {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            await new Promise<void>((resolve, reject) => {
                db.run('UPDATE rpps SET status="REMOVED", processed_by=?, processed_at=CURRENT_TIMESTAMP WHERE user_id=? AND status="ACCEPTED"', [moderatorId, userId], function (err: Error | null) {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            await db.collection('rpps').updateMany({ user_id: userId, status: 'ACCEPTED' }, { $set: { status: 'REMOVED', processed_by: moderatorId, processed_at: new Date().toISOString() } });
        }
    }
    async findById(id: number | string): Promise<RPPRecord | null> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            return new Promise<RPPRecord | null>((resolve, reject) => {
                db.get('SELECT * FROM rpps WHERE id=?', [id], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row || null);
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            const { ObjectId } = await import('mongodb');
            let objectId: any;
            try {
                objectId = new ObjectId(id as any);
            }
            catch {
                objectId = id;
            }
            const doc = await db.collection('rpps').findOne({ _id: objectId } as any);
            return doc as any || null;
        }
    }
    async listActivePaged(limit: number, offset: number): Promise<RPPRecord[]> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            return new Promise<RPPRecord[]>((resolve, reject) => {
                db.all('SELECT * FROM rpps WHERE status="ACCEPTED" ORDER BY processed_at DESC LIMIT ? OFFSET ?', [limit, offset], function (err: Error | null, rows: any[]) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows as RPPRecord[]);
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            return await db.collection('rpps').find({ status: 'ACCEPTED' }).sort({ processed_at: -1 }).skip(offset).limit(limit).toArray() as any;
        }
    }
    async listRemovedPaged(limit: number, offset: number): Promise<RPPRecord[]> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            return new Promise<RPPRecord[]>((resolve, reject) => {
                db.all('SELECT * FROM rpps WHERE status="REMOVED" ORDER BY processed_at DESC LIMIT ? OFFSET ?', [limit, offset], function (err: Error | null, rows: any[]) {
                    if (err)
                        reject(err);
                    else
                        resolve(rows as RPPRecord[]);
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            return await db.collection('rpps').find({ status: 'REMOVED' }).sort({ processed_at: -1 }).skip(offset).limit(limit).toArray() as any;
        }
    }
    async countActive(): Promise<number> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            return new Promise<number>((resolve, reject) => {
                db.get('SELECT COUNT(*) as c FROM rpps WHERE status="ACCEPTED"', [], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.c || 0);
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            return await db.collection('rpps').countDocuments({ status: 'ACCEPTED' });
        }
    }
    async countRemoved(): Promise<number> {
        if (DatabaseManager.current === 'sqlite') {
            const db = DatabaseManager.getSqlite().connection;
            return new Promise<number>((resolve, reject) => {
                db.get('SELECT COUNT(*) as c FROM rpps WHERE status="REMOVED"', [], function (err: Error | null, row: any) {
                    if (err)
                        reject(err);
                    else
                        resolve(row?.c || 0);
                });
            });
        }
        else {
            const db = DatabaseManager.getMongo().database;
            return await db.collection('rpps').countDocuments({ status: 'REMOVED' });
        }
    }
}
