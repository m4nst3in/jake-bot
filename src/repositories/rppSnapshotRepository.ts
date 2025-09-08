import { BaseRepo } from './base.ts';

export interface RppSnapshotRecord { user_id: string; roles: string[]; stored_at?: string; }

export class RppSnapshotRepository extends BaseRepo {
  async upsert(userId: string, roles: string[]) {
    if (this.isSqlite()) {
      const rolesStr = JSON.stringify(roles);
      await new Promise<void>((resolve, reject) => {
        this.sqlite.run('INSERT INTO rpp_role_snapshots (user_id, roles, stored_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET roles=excluded.roles, stored_at=CURRENT_TIMESTAMP', [userId, rolesStr], function(err){ if(err) reject(err); else resolve(); });
      });
    } else {
      await this.mongo.collection('rpp_role_snapshots').updateOne({ user_id: userId }, { $set: { roles, stored_at: new Date().toISOString() } }, { upsert: true });
    }
  }
  async get(userId: string): Promise<RppSnapshotRecord | null> {
    if (this.isSqlite()) {
      return await new Promise<RppSnapshotRecord | null>((resolve, reject) => {
        this.sqlite.get('SELECT user_id, roles, stored_at FROM rpp_role_snapshots WHERE user_id=?', [userId], function(err, row: any){ if(err) reject(err); else if(!row) resolve(null); else resolve({ user_id: row.user_id, roles: JSON.parse(row.roles||'[]'), stored_at: row.stored_at }); });
      });
    }
    const doc = await this.mongo.collection('rpp_role_snapshots').findOne({ user_id: userId });
    if (!doc) return null;
    return { user_id: doc.user_id, roles: doc.roles || [], stored_at: doc.stored_at };
  }
  async delete(userId: string) {
    if (this.isSqlite()) {
      await new Promise<void>((resolve, reject) => {
        this.sqlite.run('DELETE FROM rpp_role_snapshots WHERE user_id=?', [userId], function(err){ if(err) reject(err); else resolve(); });
      });
    } else {
      await this.mongo.collection('rpp_role_snapshots').deleteOne({ user_id: userId });
    }
  }
}
