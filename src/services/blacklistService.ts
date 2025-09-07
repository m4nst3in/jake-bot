import { BlacklistRepository } from '../repositories/blacklistRepository.ts';
import { baseEmbed } from '../utils/embeds.ts';
export class BlacklistService {
    constructor(private repo = new BlacklistRepository()) { }
    async add(discordId: string, reason: string, areaOrGlobal: string, by: string) { await this.repo.add({ discord_id: discordId, reason, area_or_global: areaOrGlobal, added_by: by }); }
    async remove(discordId: string, areaOrGlobal: string, by: string) { await this.repo.remove(discordId, areaOrGlobal, by); }
    async list(areaOrGlobal: string) { return this.repo.list(areaOrGlobal); }
    async listUser(discordId: string) { return (this.repo as any).listUserActive(discordId); }
    async listEmbed(areaOrGlobal: string) {
        const items = await this.list(areaOrGlobal);
        return baseEmbed({ title: `🚫 Blacklist ${areaOrGlobal}`, description: items.map((i: any) => `• ${i.discord_id} — ${i.reason}`).join('\n') || 'Vazia', color: 0xe74c3c });
    }
}
