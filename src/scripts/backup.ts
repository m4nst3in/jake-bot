import 'dotenv/config';
import { DatabaseManager } from '../db/manager.ts';
import fs from 'node:fs';
async function run() {
    await DatabaseManager.init();
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        const points = await new Promise<any[]>((resolve, reject) => { db.all('SELECT * FROM points', (e: Error | null, r: any[]) => e ? reject(e) : resolve(r)); });
        fs.writeFileSync('backup_points.json', JSON.stringify(points, null, 2));
    }
    else {
        const points = await DatabaseManager.getMongo().database.collection('points').find().toArray();
        fs.writeFileSync('backup_points.json', JSON.stringify(points, null, 2));
    }
    console.log('Backup concluído.');
    process.exit(0);
}
run().catch(err => { console.error(err); process.exit(1); });
