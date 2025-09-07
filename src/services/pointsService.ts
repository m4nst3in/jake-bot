import { PointRepository } from '../repositories/pointRepository.ts';
import { baseEmbed } from '../utils/embeds.ts';
import { sendPointsLog } from '../utils/pointsLogger.ts';
export class PointsService {
    constructor(private repo = new PointRepository()) { }
    async adicionar(userId: string, area: string, quantidade: number, reason: string, by: string) {
        await this.repo.addPoints(userId, area, quantidade, reason, by);
        const record = await this.repo.getUserArea(userId, area);
    const c:any = (globalThis as any).client || undefined;
    if (c) await sendPointsLog(c, 'adicionado', { userId, moderatorId: by, area, delta: quantidade, reason, total: record?.points || 0 });
    }
    async remover(userId: string, area: string, quantidade: number, reason: string, by: string) {
        const delta = -Math.abs(quantidade);
        await this.repo.addPoints(userId, area, delta, reason, by);
        const record = await this.repo.getUserArea(userId, area);
    const c:any = (globalThis as any).client || undefined;
    if (c) await sendPointsLog(c, 'removido', { userId, moderatorId: by, area, delta, reason, total: record?.points || 0 });
    }
    async registrarReport(userId: string, area: string, pontos: number, by: string) {
    await this.repo.addPoints(userId, area, pontos, 'report', by);
    const record = await this.repo.getUserArea(userId, area);
    const c:any = (globalThis as any).client || undefined;
    if (c) await sendPointsLog(c, 'adicionado', { userId, moderatorId: by, area, delta: pontos, reason: 'report', total: record?.points || 0 });
    }
    async registrarPlantao(userId: string, area: string, pontos: number, by: string) {
    await (this.repo as any).addShift(userId, area, pontos, 'plantao', by);
    const record = await this.repo.getUserArea(userId, area);
    const c:any = (globalThis as any).client || undefined;
    if (c) await sendPointsLog(c, 'adicionado', { userId, moderatorId: by, area, delta: pontos, reason: 'plantao', total: record?.points || 0 });
    }
    async ranking(area: string) {
        const top = await this.repo.getTop(area, 10);
        const flame = '<a:Blue_Flame:1324154745979408455>';
        const designEmote = '<:Designsemnome:1311826417624813598>';
        return baseEmbed({ title: `${designEmote} Ranking - ${area}`, description: top.map((r: any, i: number) => `${flame} **${i + 1}.** <@${r.user_id}> — ${r.points} pts`).join('\n') || 'Sem dados ainda', color: 0xf1c40f });
    }
    async richRanking(area: string) {
        const [top, total] = await Promise.all([this.repo.getTop(area, 10), this.repo.countArea(area)]);
        const flame = '<a:Blue_Flame:1324154745979408455>';
        const designEmote = '<:Designsemnome:1311826417624813598>';
    const filtered = top.filter((r:any)=> (r.points||0) > 0);
    const lines = filtered.map((r: any, i: number) => `${flame} **${i + 1}.** <@${r.user_id}> — **${r.points}** pts`);
        return baseEmbed({
            title: `${designEmote} Ranking • ${area}`,
            description: lines.join('\n') || 'Sem participantes ainda',
            color: 0x5865F2,
            footer: `Total de participantes: ${total}`
        });
    }
    async buildRankingEmbedUnified(area: string){
        return area === 'Suporte' ? await this.richRankingSuporte() : await this.richRanking(area);
    }
    async adicionarComRelatorio(userId: string, area: string, pontos: number, by: string){
    await (this.repo as any).addPointsAndReport(userId, area, pontos, 'relatorio_banca', by);
    const record = await this.repo.getUserArea(userId, area);
    const c:any = (globalThis as any).client || undefined;
    if (c) await sendPointsLog(c, 'adicionado', { userId, moderatorId: by, area, delta: pontos, reason: 'Relatório em Banca', total: record?.points || 0 });
    }
    async richRankingSuporte(){
        const area = 'Suporte';
        const [top, total, totalReports] = await Promise.all([
            this.repo.getTop(area, 10),
            this.repo.countArea(area),
            (this.repo as any).sumReports(area)
        ]);
        const flame = '<a:Blue_Flame:1324154745979408455>';
        const designEmote = '<:Designsemnome:1311826417624813598>';
    const filtered = top.filter((r:any)=> (r.points||0) > 0);
    const lines = filtered.map((r:any,i:number)=>`${flame} **${i+1}.** <@${r.user_id}> — **${r.points}** pts • 🧾 ${r.reports_count||0} rel. • 🕒 ${r.shifts_count||0} plant.`);
        return baseEmbed({
            title: `${designEmote} Ranking de Suporte`,
            description: lines.join('\n') || 'Sem participantes ainda',
            color: 0x2b2d31,
            footer: `Participantes: ${total} • Relatórios: ${totalReports}`
        });
    }
    async resetAll(){ await (this.repo as any).resetAllPoints(); }
    async resetArea(area: string){ await (this.repo as any).resetArea(area); }
}
