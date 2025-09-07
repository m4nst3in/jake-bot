import { BlacklistService } from '../src/services/blacklistService.ts';

describe('BlacklistService', () => {
  it('list embed empty', async () => {
    const svc = new BlacklistService({
      add: async ()=>{}, remove: async ()=>{}, list: async ()=>[]
    } as any);
    const embed = await svc.listEmbed('GERAL');
    expect(embed.data.title).toContain('Blacklist');
  });
});
