import sqlite3 from 'sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { MongoClient } from 'mongodb';

sqlite3.verbose();

function exists(file: string) {
  try { return fs.existsSync(file); } catch { return false; }
}

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

async function migrate() {
  const coreFile = process.env.SQLITE_CORE_FILE || process.env.SQLITE_FILE || './data/core.db';
  const pointsFile = process.env.SQLITE_POINTS_FILE || './data/points.db';
  const blacklistFile = process.env.SQLITE_BLACKLIST_FILE || './data/blacklist.db';
  const rppFile = process.env.SQLITE_RPP_FILE || './data/rpp.db';

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/jake';
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db();
  console.log(`[mongo] Connected to: ${mongoUri}`);

  // Optional: clean target collections first? We'll upsert/insert without delete to be safe
  // Helper to bulk insert with small batches
  async function insertMany(coll: string, docs: any[]) {
    if (!docs.length) return;
    const batchSize = 1000;
    for (let i = 0; i < docs.length; i += batchSize) {
      const chunk = docs.slice(i, i + batchSize);
      await db.collection(coll).insertMany(chunk, { ordered: false }).catch(() => {});
    }
  }

  // CORE
  if (exists(coreFile)) {
    const coreDb = await openDb(coreFile);
    const tables: Record<string, string> = {
      users: 'users',
      occurrences: 'occurrences',
      role_transfers: 'role_transfers',
      audits: 'audits',
      config: 'config',
      bancas: 'bancas',
      staff_members: 'staff_members',
    };
    for (const [table, coll] of Object.entries(tables)) {
      try {
        const rows = await all<any>(coreDb, `SELECT * FROM ${table}`);
        console.log(`[migrate] ${table} -> ${coll}: ${rows.length}`);
        if (rows.length) await insertMany(coll, rows);
      } catch (e) {
        // ignore if table not found
      }
    }
    coreDb.close();
  } else {
    console.log(`[skip] core file not found: ${coreFile}`);
  }

  // POINTS
  if (exists(pointsFile)) {
    const pDb = await openDb(pointsFile);
    try {
      const points = await all<any>(pDb, 'SELECT * FROM points');
      console.log(`[migrate] points: ${points.length}`);
      if (points.length) await insertMany('points', points);
    } catch {}
    try {
      const logs = await all<any>(pDb, 'SELECT * FROM point_logs');
      console.log(`[migrate] point_logs: ${logs.length}`);
      if (logs.length) await insertMany('point_logs', logs);
    } catch {}
    pDb.close();
  } else {
    console.log(`[skip] points file not found: ${pointsFile}`);
  }

  // BLACKLIST
  if (exists(blacklistFile)) {
    const bDb = await openDb(blacklistFile);
    try {
      const rows = await all<any>(bDb, 'SELECT * FROM blacklist');
      console.log(`[migrate] blacklist: ${rows.length}`);
      if (rows.length) await insertMany('blacklist', rows);
    } catch {}
    bDb.close();
  } else {
    console.log(`[skip] blacklist file not found: ${blacklistFile}`);
  }

  // RPP
  if (exists(rppFile)) {
    const rDb = await openDb(rppFile);
    try {
      const rows = await all<any>(rDb, 'SELECT * FROM rpps');
      console.log(`[migrate] rpps: ${rows.length}`);
      if (rows.length) await insertMany('rpps', rows);
    } catch {}
    try {
      const snaps = await all<any>(rDb, 'SELECT * FROM rpp_role_snapshots');
      console.log(`[migrate] rpp_role_snapshots: ${snaps.length}`);
      if (snaps.length) await insertMany('rpp_role_snapshots', snaps.map(s => ({...s, roles: typeof s.roles === 'string' ? JSON.parse(s.roles) : s.roles })));
    } catch {}
    rDb.close();
  } else {
    console.log(`[skip] rpp file not found: ${rppFile}`);
  }

  // Indexes
  await db.collection('users').createIndex({ discord_id: 1 }, { unique: true }).catch(()=>{});
  await db.collection('rpps').createIndex({ user_id: 1 }).catch(()=>{});
  await db.collection('points').createIndex({ user_id: 1, area: 1 }, { unique: true }).catch(()=>{});
  await db.collection('blacklist').createIndex({ discord_id: 1 }).catch(()=>{});

  await client.close();
  console.log('[migrate] Completed SQLite -> Mongo migration');
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err);
  process.exit(1);
});
