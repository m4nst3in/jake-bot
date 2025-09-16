import { BaseRepo } from './base.ts';
import { logger } from '../utils/logger.ts';

export interface PunishmentRecord {
    id?: string;
    userId: string;
    executorId: string;
    punishmentType: string;
    punishmentName: string;
    reason: string;
    duration?: number;
    durationType?: string;
    appliedAt: Date;
    expiresAt?: Date;
    active: boolean;
    guildId: string;
    proofUrl?: string;
    removedAt?: Date;
    removedBy?: string;
    removalReason?: string;
}

export interface PunishmentHistoryQuery {
    executorId?: string;
    userId?: string;
    guildId?: string;
    active?: boolean;
    punishmentType?: string;
    limit?: number;
    offset?: number;
    startDate?: Date;
    endDate?: Date;
}

export class PunishmentRepository extends BaseRepo {
    
    async create(punishment: Omit<PunishmentRecord, 'id' | 'appliedAt'>): Promise<string> {
        try {
            const record: PunishmentRecord = {
                ...punishment,
                appliedAt: new Date(),
            };

            if (this.isSqlite()) {
                const result = await this.sqlite.run(`
                    INSERT INTO punishments (
                        userId, executorId, punishmentType, punishmentName, reason,
                        duration, durationType, appliedAt, expiresAt, active, guildId, proofUrl
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    record.userId,
                    record.executorId,
                    record.punishmentType,
                    record.punishmentName,
                    record.reason,
                    record.duration || null,
                    record.durationType || null,
                    record.appliedAt.toISOString(),
                    record.expiresAt?.toISOString() || null,
                    record.active ? 1 : 0,
                    record.guildId,
                    record.proofUrl || null
                ]);
                return (result as any).lastID?.toString() || '';
            } else {
                const result = await this.mongo.collection('punishments').insertOne(record);
                return result.insertedId.toString();
            }
        } catch (error) {
            logger.error({ error, punishment }, 'Erro ao criar registro de punição');
            throw error;
        }
    }

    async findByExecutor(executorId: string, options: PunishmentHistoryQuery = {}): Promise<{
        punishments: PunishmentRecord[];
        total: number;
    }> {
        try {
            const {
                guildId,
                active,
                punishmentType,
                limit = 10,
                offset = 0,
                startDate,
                endDate
            } = options;

            if (this.isSqlite()) {
                let whereConditions = ['executorId = ?'];
                let params: any[] = [executorId];

                if (guildId) {
                    whereConditions.push('guildId = ?');
                    params.push(guildId);
                }

                if (active !== undefined) {
                    whereConditions.push('active = ?');
                    params.push(active ? 1 : 0);
                }

                if (punishmentType) {
                    whereConditions.push('punishmentType = ?');
                    params.push(punishmentType);
                }

                if (startDate) {
                    whereConditions.push('appliedAt >= ?');
                    params.push(startDate.toISOString());
                }

                if (endDate) {
                    whereConditions.push('appliedAt <= ?');
                    params.push(endDate.toISOString());
                }

                const whereClause = whereConditions.join(' AND ');

                // Get total count
                const countResult = await this.sqlite.get(
                    `SELECT COUNT(*) as total FROM punishments WHERE ${whereClause}`,
                    params
                ) as any;
                const total = countResult?.total || 0;

                // Get paginated results
                const punishments = await this.sqlite.all(`
                    SELECT * FROM punishments 
                    WHERE ${whereClause}
                    ORDER BY appliedAt DESC
                    LIMIT ? OFFSET ?
                `, [...params, limit, offset]) as unknown as any[];

                return {
                    punishments: punishments.map(this.mapSqliteRecord),
                    total
                };
            } else {
                const filter: any = { executorId };

                if (guildId) filter.guildId = guildId;
                if (active !== undefined) filter.active = active;
                if (punishmentType) filter.punishmentType = punishmentType;
                if (startDate || endDate) {
                    filter.appliedAt = {};
                    if (startDate) filter.appliedAt.$gte = startDate;
                    if (endDate) filter.appliedAt.$lte = endDate;
                }

                const [punishments, total] = await Promise.all([
                    this.mongo.collection('punishments')
                        .find(filter)
                        .sort({ appliedAt: -1 })
                        .skip(offset)
                        .limit(limit)
                        .toArray(),
                    this.mongo.collection('punishments').countDocuments(filter)
                ]);

                return {
                    punishments: punishments.map(this.mapMongoRecord),
                    total
                };
            }
        } catch (error) {
            logger.error({ error, executorId, options }, 'Erro ao buscar punições por executor');
            throw error;
        }
    }

    async findByUser(userId: string, options: PunishmentHistoryQuery = {}): Promise<{
        punishments: PunishmentRecord[];
        total: number;
    }> {
        try {
            const {
                guildId,
                active,
                punishmentType,
                limit = 10,
                offset = 0,
                startDate,
                endDate
            } = options;

            if (this.isSqlite()) {
                let whereConditions = ['userId = ?'];
                let params: any[] = [userId];

                if (guildId) {
                    whereConditions.push('guildId = ?');
                    params.push(guildId);
                }

                if (active !== undefined) {
                    whereConditions.push('active = ?');
                    params.push(active ? 1 : 0);
                }

                if (punishmentType) {
                    whereConditions.push('punishmentType = ?');
                    params.push(punishmentType);
                }

                if (startDate) {
                    whereConditions.push('appliedAt >= ?');
                    params.push(startDate.toISOString());
                }

                if (endDate) {
                    whereConditions.push('appliedAt <= ?');
                    params.push(endDate.toISOString());
                }

                const whereClause = whereConditions.join(' AND ');

                const countResult = await this.sqlite.get(
                    `SELECT COUNT(*) as total FROM punishments WHERE ${whereClause}`,
                    params
                ) as any;
                const total = countResult?.total || 0;

                const punishments = await this.sqlite.all(`
                    SELECT * FROM punishments 
                    WHERE ${whereClause}
                    ORDER BY appliedAt DESC
                    LIMIT ? OFFSET ?
                `, [...params, limit, offset]) as unknown as any[];

                return {
                    punishments: punishments.map(this.mapSqliteRecord),
                    total
                };
            } else {
                const filter: any = { userId };

                if (guildId) filter.guildId = guildId;
                if (active !== undefined) filter.active = active;
                if (punishmentType) filter.punishmentType = punishmentType;
                if (startDate || endDate) {
                    filter.appliedAt = {};
                    if (startDate) filter.appliedAt.$gte = startDate;
                    if (endDate) filter.appliedAt.$lte = endDate;
                }

                const [punishments, total] = await Promise.all([
                    this.mongo.collection('punishments')
                        .find(filter)
                        .sort({ appliedAt: -1 })
                        .skip(offset)
                        .limit(limit)
                        .toArray(),
                    this.mongo.collection('punishments').countDocuments(filter)
                ]);

                return {
                    punishments: punishments.map(this.mapMongoRecord),
                    total
                };
            }
        } catch (error) {
            logger.error({ error, userId, options }, 'Erro ao buscar punições por usuário');
            throw error;
        }
    }

    async updateStatus(id: string, active: boolean, removedBy?: string, removalReason?: string): Promise<void> {
        try {
            if (this.isSqlite()) {
                await this.sqlite.run(`
                    UPDATE punishments 
                    SET active = ?, removedAt = ?, removedBy = ?, removalReason = ?
                    WHERE id = ?
                `, [
                    active ? 1 : 0,
                    active ? null : new Date().toISOString(),
                    removedBy || null,
                    removalReason || null,
                    id
                ]);
            } else {
                const updateData: any = { 
                    active,
                    removedAt: active ? null : new Date(),
                    removedBy: removedBy || null,
                    removalReason: removalReason || null
                };

                await this.mongo.collection('punishments').updateOne(
                    { _id: id as any },
                    { $set: updateData }
                );
            }
        } catch (error) {
            logger.error({ error, id, active }, 'Erro ao atualizar status da punição');
            throw error;
        }
    }

    async getStatistics(executorId: string, guildId?: string): Promise<{
        totalPunishments: number;
        activePunishments: number;
        punishmentsByType: Record<string, number>;
        recentPunishments: number; // Last 30 days
    }> {
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            if (this.isSqlite()) {
                let baseWhere = 'executorId = ?';
                let params = [executorId];

                if (guildId) {
                    baseWhere += ' AND guildId = ?';
                    params.push(guildId);
                }

                const [totalResult, activeResult, recentResult] = await Promise.all([
                    this.sqlite.get(`SELECT COUNT(*) as count FROM punishments WHERE ${baseWhere}`, params) as unknown as Promise<any>,
                    this.sqlite.get(`SELECT COUNT(*) as count FROM punishments WHERE ${baseWhere} AND active = 1`, params) as unknown as Promise<any>,
                    this.sqlite.get(`SELECT COUNT(*) as count FROM punishments WHERE ${baseWhere} AND appliedAt >= ?`, [...params, thirtyDaysAgo.toISOString()]) as unknown as Promise<any>
                ]);

                const typeResults = await this.sqlite.all(`
                    SELECT punishmentType, COUNT(*) as count 
                    FROM punishments 
                    WHERE ${baseWhere}
                    GROUP BY punishmentType
                `, params) as unknown as any[];

                const punishmentsByType: Record<string, number> = {};
                typeResults.forEach((row: any) => {
                    punishmentsByType[row.punishmentType] = row.count;
                });

                return {
                    totalPunishments: totalResult?.count || 0,
                    activePunishments: activeResult?.count || 0,
                    recentPunishments: recentResult?.count || 0,
                    punishmentsByType
                };
            } else {
                const filter: any = { executorId };
                if (guildId) filter.guildId = guildId;

                const [totalPunishments, activePunishments, recentPunishments, typeAggregation] = await Promise.all([
                    this.mongo.collection('punishments').countDocuments(filter),
                    this.mongo.collection('punishments').countDocuments({ ...filter, active: true }),
                    this.mongo.collection('punishments').countDocuments({ ...filter, appliedAt: { $gte: thirtyDaysAgo } }),
                    this.mongo.collection('punishments').aggregate([
                        { $match: filter },
                        { $group: { _id: '$punishmentType', count: { $sum: 1 } } }
                    ]).toArray()
                ]);

                const punishmentsByType: Record<string, number> = {};
                typeAggregation.forEach((item: any) => {
                    punishmentsByType[item._id] = item.count;
                });

                return {
                    totalPunishments,
                    activePunishments,
                    recentPunishments,
                    punishmentsByType
                };
            }
        } catch (error) {
            logger.error({ error, executorId, guildId }, 'Erro ao obter estatísticas de punições');
            throw error;
        }
    }

    private mapSqliteRecord(row: any): PunishmentRecord {
        return {
            id: row.id?.toString(),
            userId: row.userId,
            executorId: row.executorId,
            punishmentType: row.punishmentType,
            punishmentName: row.punishmentName,
            reason: row.reason,
            duration: row.duration,
            durationType: row.durationType,
            appliedAt: new Date(row.appliedAt),
            expiresAt: row.expiresAt ? new Date(row.expiresAt) : undefined,
            active: Boolean(row.active),
            guildId: row.guildId,
            proofUrl: row.proofUrl,
            removedAt: row.removedAt ? new Date(row.removedAt) : undefined,
            removedBy: row.removedBy,
            removalReason: row.removalReason
        };
    }

    private mapMongoRecord(doc: any): PunishmentRecord {
        return {
            id: doc._id?.toString(),
            userId: doc.userId,
            executorId: doc.executorId,
            punishmentType: doc.punishmentType,
            punishmentName: doc.punishmentName,
            reason: doc.reason,
            duration: doc.duration,
            durationType: doc.durationType,
            appliedAt: doc.appliedAt,
            expiresAt: doc.expiresAt,
            active: doc.active,
            guildId: doc.guildId,
            proofUrl: doc.proofUrl,
            removedAt: doc.removedAt,
            removedBy: doc.removedBy,
            removalReason: doc.removalReason
        };
    }
}
