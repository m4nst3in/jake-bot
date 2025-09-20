import sqlite3 from 'sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { SqliteAdapter } from './adapter.ts';

sqlite3.verbose();

function openDb(file: string): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const db = new sqlite3.Database(file, (err) => {
      if (err) return reject(err);
      resolve(db);
    });
  });
}

function all<T = any>(db: sqlite3.Database, sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows as T[]);
    });
  });
}

function run(db: sqlite3.Database, sql: string, params: any[] = []): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function migrate() {
  const oldFile = process.env.SQLITE_OLD_FILE || process.env.SQLITE_FILE || './data/jake.db';
  const coreFile = process.env.SQLITE_CORE_FILE || './data/core.db';
  const pointsFile = process.env.SQLITE_POINTS_FILE || './data/points.db';
  const blacklistFile = process.env.SQLITE_BLACKLIST_FILE || './data/blacklist.db';
  const rppFile = process.env.SQLITE_RPP_FILE || './data/rpp.db';

  console.log(`[migrate] Reading from old db: ${oldFile}`);
  const oldDb = await openDb(oldFile);

  // Prepare target DBs and their schemas
  const core = new SqliteAdapter(coreFile, 'core');
  const points = new SqliteAdapter(pointsFile, 'points');
  const blacklist = new SqliteAdapter(blacklistFile, 'blacklist');
  const rpp = new SqliteAdapter(rppFile, 'rpp');
  await core.connect();
  await points.connect();
  await blacklist.connect();
  await rpp.connect();

  const coreDb = core.connection;
  const pointsDb = points.connection;
  const blacklistDb = blacklist.connection;
  const rppDb = rpp.connection;

  // Helper to check if table exists in old db
  async function hasTable(name: string): Promise<boolean> {
    const rows = await all(oldDb, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [name]);
    return rows.length > 0;
  }

  // Points & point_logs
  if (await hasTable('points')) {
    console.log('[migrate] Moving points...');
    const rows = await all<any>(oldDb, 'SELECT id, user_id, area, points, reports_count, shifts_count, last_updated FROM points');
    for (const r of rows) {
      await run(pointsDb, 'INSERT INTO points (id, user_id, area, points, reports_count, shifts_count, last_updated) VALUES (?,?,?,?,?,?,?)', [r.id, r.user_id, r.area, r.points, r.reports_count, r.shifts_count, r.last_updated]);
    }
  }
  if (await hasTable('point_logs')) {
    console.log('[migrate] Moving point_logs...');
    const logs = await all<any>(oldDb, 'SELECT id, user_id, change, reason, by, timestamp FROM point_logs');
    for (const r of logs) {
      await run(pointsDb, 'INSERT INTO point_logs (id, user_id, change, reason, by, timestamp) VALUES (?,?,?,?,?,?)', [r.id, r.user_id, r.change, r.reason, r.by, r.timestamp]);
    }
  }

  // Blacklist
  if (await hasTable('blacklist')) {
    console.log('[migrate] Moving blacklist...');
    const rows = await all<any>(oldDb, 'SELECT id, discord_id, reason, area_or_global, added_by, added_at, removed_by, removed_at FROM blacklist');
    for (const r of rows) {
      await run(blacklistDb, 'INSERT INTO blacklist (id, discord_id, reason, area_or_global, added_by, added_at, removed_by, removed_at) VALUES (?,?,?,?,?,?,?,?)', [r.id, r.discord_id, r.reason, r.area_or_global, r.added_by, r.added_at, r.removed_by, r.removed_at]);
    }
  }

  // RPPs
  if (await hasTable('rpps')) {
    console.log('[migrate] Moving rpps...');
    const rows = await all<any>(oldDb, 'SELECT id, user_id, status, requested_at, processed_by, processed_at, reason, return_date FROM rpps');
    for (const r of rows) {
      await run(rppDb, 'INSERT INTO rpps (id, user_id, status, requested_at, processed_by, processed_at, reason, return_date) VALUES (?,?,?,?,?,?,?,?)', [r.id, r.user_id, r.status, r.requested_at, r.processed_by, r.processed_at, r.reason, r.return_date]);
    }
  }
  if (await hasTable('rpp_role_snapshots')) {
    console.log('[migrate] Moving rpp_role_snapshots...');
    const rows = await all<any>(oldDb, 'SELECT id, user_id, roles, stored_at FROM rpp_role_snapshots');
    for (const r of rows) {
      await run(rppDb, 'INSERT INTO rpp_role_snapshots (id, user_id, roles, stored_at) VALUES (?,?,?,?)', [r.id, r.user_id, r.roles, r.stored_at]);
    }
  }

  // Core tables (optional): copy known core tables if they exist
  const coreTables = ['users', 'occurrences', 'role_transfers', 'audits', 'config', 'bancas', 'staff_members'];
  for (const tbl of coreTables) {
    if (await hasTable(tbl)) {
      console.log(`[migrate] Moving core table ${tbl}...`);
      const rows = await all<any>(oldDb, `SELECT * FROM ${tbl}`);
      if (!rows.length) continue;
      const cols = Object.keys(rows[0]);
      const placeholders = cols.map(() => '?').join(',');
      for (const r of rows) {
        const values = cols.map((c) => (r as any)[c]);
        await run(coreDb, `INSERT INTO ${tbl} (${cols.join(',')}) VALUES (${placeholders})`, values);
      }
    }
  }

  console.log('[migrate] Done.');
  oldDb.close();
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
