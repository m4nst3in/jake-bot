import { StaffRepository } from '../repositories/staffRepository.ts';
export interface StaffRankRecord {
    id: string;
    rankRoleId?: string;
}
export class StaffService {
    constructor(private repo = new StaffRepository()) { }
    async replaceAll(map: StaffRankRecord[]) { await this.repo.replaceAll(map); }
    async upsertMany(map: StaffRankRecord[]) { await this.repo.upsertMany(map); }
    async isStaff(id: string) { return this.repo.isStaff(id); }
    async list() { return this.repo.listAll(); }
}
