import { BaseRepo } from './base.js'; // keep .js extension for ES module compatibility

export class StaffRepository extends BaseRepo {
  async clearAll() {
    if (this.isSqlite()) {
      await new Promise<void>((resolve, reject) => {
        this.sqlite.run('DELETE FROM staff_members', [], function(err){ if(err) reject(err); else resolve(); });
      });
    } else {
      await this.mongo.collection('staff_members').deleteMany({});
    }
  }
  async upsertMany(map: { id: string; rankRoleId?: string }[]) {
    if (!map.length) return;
    if (this.isSqlite()) {
      const stmt = this.sqlite.prepare('INSERT INTO staff_members (discord_id, rank_role_id) VALUES (?, ?) ON CONFLICT(discord_id) DO UPDATE SET rank_role_id=excluded.rank_role_id');
      await new Promise<void>((resolve, reject) => {
        this.sqlite.serialize(()=> {
          for (const m of map) stmt.run(m.id, m.rankRoleId || null);
          stmt.finalize(err=> err? reject(err): resolve());
        });
      });
    } else {
      await this.mongo.collection('staff_members').bulkWrite(map.map(m=>({ updateOne: { filter: { discord_id: m.id }, update: { $set: { rank_role_id: m.rankRoleId || null }, $setOnInsert: { added_at: new Date().toISOString() } }, upsert: true } })));
    }
  }
  async replaceAll(map: { id: string; rankRoleId?: string }[]) {
    if (this.isSqlite()) {
      await new Promise<void>((resolve, reject) => {
        this.sqlite.run('DELETE FROM staff_members', [], function(err){ if(err) reject(err); else resolve(); });
      });
      await this.upsertMany(map);
    } else {
      await this.mongo.collection('staff_members').deleteMany({});
      await this.upsertMany(map);
    }
  }
  async isStaff(id: string) {
    if (this.isSqlite()) {
      return await new Promise<boolean>((resolve, reject) => {
        this.sqlite.get('SELECT 1 FROM staff_members WHERE discord_id=?', [id], function(err, row){ if(err) reject(err); else resolve(!!row); });
      });
    }
    const doc = await this.mongo.collection('staff_members').findOne({ discord_id: id });
    return !!doc;
  }
  async listAll() {
    if (this.isSqlite()) {
      return await new Promise<any[]>((resolve, reject) => {
        this.sqlite.all('SELECT discord_id, rank_role_id FROM staff_members', [], function(err, rows){ if(err) reject(err); else resolve(rows); });
      });
    }
    return await this.mongo.collection('staff_members').find({}, { projection: { discord_id: 1, rank_role_id: 1, _id: 0 } }).toArray();
  }
}
