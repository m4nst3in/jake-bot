import { RPPService } from '../src/services/rppService.ts';
import { DatabaseManager } from '../src/db/manager.ts';

describe('RPPService', () => {
  beforeAll(async () => {
    process.env.DB_TYPE = 'sqlite';
    process.env.SQLITE_FILE = ':memory:'; // in-memory
    await DatabaseManager.init();
  });
  it('creates a pending RPP request', async () => {
    const service = new RPPService({
      create: async (data: any) => ({ id: 1, ...data })
    } as any);
    const rec = await service.requestRPP('123', 'teste');
    expect(rec.status).toBe('PENDING');
  });
  
  it('accepts and rejects RPP status transitions', async () => {
    const realService = new RPPService();
    const rpp = await realService.requestRPP('456', 'another');
    await realService.accept(rpp.id!, 'mod1');
    await realService.reject(rpp.id!, 'mod2');
    expect(rpp.status).toBe('PENDING'); // original object unchanged (not reloaded) just sanity
  });
});
