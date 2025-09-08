import { PointsService } from '../src/services/pointsService.ts';
describe('PointsService', () => {
    it('ranking embed empty', async () => {
        const svc = new PointsService({
            addPoints: async () => { },
            getTop: async () => []
        } as any);
        const embed = await svc.ranking('Design');
        expect(embed.data.title).toContain('Ranking');
    });
    it('remover converte quantidade em delta negativo', async () => {
        const calls: any[] = [];
        const svc = new PointsService({
            addPoints: async (userId: string, area: string, delta: number) => { calls.push(delta); },
            getTop: async () => []
        } as any);
        await (svc as any).remover('123', 'Design', 50, 'motivo', '999');
        expect(calls[0]).toBe(-50);
    });
});
