import { RPPRepository } from '../repositories/rppRepository.ts';
import { logger } from '../utils/logger.ts';
export class RPPService {
    constructor(private repo = new RPPRepository()) { }
    async requestRPP(userId: string, reason?: string, returnDate?: string) {
        const record = await this.repo.create({
            user_id: userId,
            status: 'PENDING',
            requested_at: new Date().toISOString(),
            reason,
            return_date: returnDate
        });
        logger.info({ record }, 'RPP request created');
        return record;
    }
    async accept(id: number | string, moderatorId: string) {
        await this.repo.updateStatus(id, 'ACCEPTED', moderatorId);
        logger.info({ id, moderatorId }, 'RPP aceito');
    }
    async reject(id: number | string, moderatorId: string) {
        await this.repo.updateStatus(id, 'REJECTED', moderatorId);
        logger.info({ id, moderatorId }, 'RPP rejeitado');
    }
    async pendingList() {
        return this.repo.listPending();
    }
    async hasPending(userId: string) {
        return !!(await this.repo.findPendingByUser(userId));
    }
    async hasActive(userId: string) {
        return !!(await (this.repo as any).findActiveByUser(userId));
    }
    async activatePending(userId: string, moderatorId: string) {
        const pending = await this.repo.findPendingByUser(userId);
        if (!pending)
            return false;
        await this.repo.updateStatus(pending.id!, 'ACCEPTED', moderatorId);
        return true;
    }
    async removeActive(userId: string, moderatorId: string) {
        await this.repo.markRemoved(userId, moderatorId);
    }
    async listActive(userIds?: string[]) {
        return this.repo.listActive(userIds);
    }
    async listActivePaged(page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            this.repo.listActivePaged(pageSize, offset),
            this.repo.countActive()
        ]);
        return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
    }
    async listRemovedPaged(page = 1, pageSize = 10) {
        const offset = (page - 1) * pageSize;
        const [items, total] = await Promise.all([
            this.repo.listRemovedPaged(pageSize, offset),
            this.repo.countRemoved()
        ]);
        return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
    }
    async resetAll() {
        await (this.repo as any).clearAll();
        logger.warn('All RPP records cleared');
    }
}
