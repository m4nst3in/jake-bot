import { DatabaseManager } from '../db/manager.ts';
import { logger } from '../utils/logger.ts';
import fs from 'node:fs';
import path from 'node:path';

async function migratePunishments() {
    try {
        logger.info('Iniciando migração da tabela de punições...');
        
        // Initialize database connection
        await DatabaseManager.initialize();
        
        if (DatabaseManager.current === 'sqlite') {
            logger.info('Executando migração SQLite...');
            
            const migrationPath = path.join(process.cwd(), 'src', 'db', 'sqlite', 'migrations', 'add_punishments_table.sql');
            const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
            
            // Split by semicolon and execute each statement
            const statements = migrationSQL.split(';').filter(stmt => stmt.trim().length > 0);
            
            for (const statement of statements) {
                if (statement.trim()) {
                    await DatabaseManager.getSqlite().connection.exec(statement.trim());
                    logger.info(`Executado: ${statement.trim().substring(0, 50)}...`);
                }
            }
            
            logger.info('Migração SQLite concluída com sucesso!');
        } else {
            logger.info('Executando migração MongoDB...');
            
            const db = DatabaseManager.getMongo().database;
            
            // Create indexes for punishments collection
            await db.collection('punishments').createIndex({ "executorId": 1 });
            await db.collection('punishments').createIndex({ "userId": 1 });
            await db.collection('punishments').createIndex({ "guildId": 1 });
            await db.collection('punishments').createIndex({ "active": 1 });
            await db.collection('punishments').createIndex({ "appliedAt": 1 });
            await db.collection('punishments').createIndex({ "punishmentType": 1 });
            
            // Compound indexes
            await db.collection('punishments').createIndex({ "executorId": 1, "guildId": 1 });
            await db.collection('punishments').createIndex({ "userId": 1, "guildId": 1 });
            await db.collection('punishments').createIndex({ "executorId": 1, "active": 1 });
            await db.collection('punishments').createIndex({ "userId": 1, "active": 1 });
            await db.collection('punishments').createIndex({ "appliedAt": 1, "active": 1 });
            
            logger.info('Migração MongoDB concluída com sucesso!');
        }
        
        logger.info('Migração da tabela de punições finalizada!');
        process.exit(0);
        
    } catch (error) {
        logger.error({ error }, 'Erro durante a migração');
        process.exit(1);
    }
}

// Execute migration
migratePunishments();
