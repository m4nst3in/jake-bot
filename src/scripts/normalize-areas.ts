import 'dotenv/config';
import { DatabaseManager } from '../db/manager.ts';
import { logger } from '../utils/logger.ts';

function normAreaKey(input: string): string {
  const base = (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  // Normalize to detection key (lower): we treat any variant as 'movcall'
  if (base === 'mov call' || base === 'movcall') return 'movcall';
  return base;
}

async function normalizeSqlite() {
  const db = DatabaseManager.getSqlite().connection;
  await new Promise<void>((resolve, reject) => db.serialize(async () => {
    try {
      // Find all distinct area variants that collapse to 'movcall'
      const variants: string[] = await new Promise((res, rej) => {
        db.all("SELECT DISTINCT area FROM points", [], (err, rows: any[]) => {
          if (err) return rej(err);
          const vs = (rows || []).map(r => String(r.area)).filter(a => normAreaKey(a) === 'movcall');
          res(vs);
        });
      });
      if (!variants.length) return resolve();

      logger.info({ variants }, 'Encontradas variantes de area para Movcall');

      await new Promise<void>((resT, rejT) => {
        db.run('BEGIN TRANSACTION', [], (err) => err ? rejT(err) : resT());
      });

      try {
        // Aggregate by user across all variants that map to movcall
        const perUser: Array<{ user_id: string; totalPoints: number; totalReports: number; totalShifts: number; lastUpdated: string | null }>
          = await new Promise((res, rej) => {
            const placeholders = variants.map(() => '?').join(',');
            db.all(
              `SELECT user_id,
                      SUM(points) AS totalPoints,
                      SUM(COALESCE(reports_count,0)) AS totalReports,
                      SUM(COALESCE(shifts_count,0)) AS totalShifts,
                      MAX(COALESCE(last_updated,'')) AS lastUpdated
               FROM points
               WHERE area IN (${placeholders})
               GROUP BY user_id`,
              variants,
              (err, rows: any[]) => err ? rej(err) : res(rows as any)
            );
          });

        for (const row of perUser) {
          // Delete existing rows for these variants
          await new Promise<void>((res, rej) => {
            const placeholders = variants.map(() => '?').join(',');
            db.run(
              `DELETE FROM points WHERE user_id=? AND area IN (${placeholders})`,
              [row.user_id, ...variants],
              (err) => err ? rej(err) : res()
            );
          });
          // Upsert unified row with area='Movcall'
          await new Promise<void>((res, rej) => {
            db.run(
              `INSERT INTO points (user_id, area, points, reports_count, shifts_count, last_updated)
               VALUES (?, 'Movcall', ?, ?, ?, ?)
               ON CONFLICT(user_id, area) DO UPDATE SET
                 points=points+excluded.points,
                 reports_count=COALESCE(reports_count,0)+COALESCE(excluded.reports_count,0),
                 shifts_count=COALESCE(shifts_count,0)+COALESCE(excluded.shifts_count,0),
                 last_updated=CASE WHEN COALESCE(excluded.last_updated,'')>COALESCE(last_updated,'') THEN excluded.last_updated ELSE last_updated END`,
              [row.user_id, row.totalPoints || 0, row.totalReports || 0, row.totalShifts || 0, row.lastUpdated || null],
              (err) => err ? rej(err) : res()
            );
          });
        }

        await new Promise<void>((resT2, rejT2) => {
          db.run('COMMIT', [], (err) => err ? rejT2(err) : resT2());
        });
      } catch (e) {
        await new Promise<void>((resT2, rejT2) => {
          db.run('ROLLBACK', [], (err) => err ? rejT2(err) : resT2());
        });
        throw e;
      }

      resolve();
    } catch (e) {
      reject(e);
    }
  }));
}

async function normalizeMongo() {
  const db = DatabaseManager.getMongo().database;
  const points = db.collection('points');

  // Find all variants that normalize to 'movcall'
  const distinctAreas: string[] = await points.distinct('area');
  const variants = distinctAreas.filter(a => normAreaKey(String(a)) === 'movcall');
  if (!variants.length) return;
  logger.info({ variants }, 'Encontradas variantes de area para Movcall (Mongo)');

  // Aggregate by user_id across variants
  const cursor = points.aggregate([
    { $match: { area: { $in: variants } } },
    {
      $group: {
        _id: '$user_id',
        totalPoints: { $sum: { $ifNull: ['$points', 0] } },
        totalReports: { $sum: { $ifNull: ['$reports_count', 0] } },
        totalShifts: { $sum: { $ifNull: ['$shifts_count', 0] } },
        lastUpdated: { $max: { $ifNull: ['$last_updated', ''] } }
      }
    }
  ]);

  const bulk = points.initializeUnorderedBulkOp();
  for await (const doc of cursor as any) {
    const userId = String(doc._id);
    // Remove existing variant docs
    bulk.find({ user_id: userId, area: { $in: variants } }).delete();
    // Upsert unified doc as 'Movcall'
    bulk.find({ user_id: userId, area: 'Movcall' }).upsert().updateOne({
      $inc: {
        points: doc.totalPoints || 0,
        reports_count: doc.totalReports || 0,
        shifts_count: doc.totalShifts || 0
      },
      $set: {
        last_updated: doc.lastUpdated || null
      }
    });
  }
  if ((bulk as any).length) {
    await bulk.execute();
  }
}

async function main() {
  await DatabaseManager.init();
  logger.info({ db: DatabaseManager.current }, 'Iniciando normalização de áreas');
  if (DatabaseManager.current === 'sqlite') {
    await normalizeSqlite();
  } else {
    await normalizeMongo();
  }
  logger.info('Normalização concluída.');
}

main().catch((e) => {
  logger.error({ e }, 'Erro na normalização de áreas');
  process.exitCode = 1;
});
