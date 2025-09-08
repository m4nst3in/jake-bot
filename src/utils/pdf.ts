import PDFDocument from 'pdfkit';
import { Client } from 'discord.js';
import { DatabaseManager } from '../db/manager.ts';
import { readFileSync, existsSync } from 'fs';
interface MemberRow {
    user_id: string;
    points: number;
    reports_count: number;
    shifts_count: number;
}
async function fetchAreaRows(area: string): Promise<MemberRow[]> {
    const sort = (a: MemberRow, b: MemberRow) => b.points - a.points;
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        const rows: any[] = await new Promise((resolve, reject) => {
            db.all('SELECT user_id, points, reports_count, shifts_count FROM points WHERE area=?', [area], (err: Error | null, r: any[]) => err ? reject(err) : resolve(r));
        });
        return rows.sort(sort);
    }
    const db = DatabaseManager.getMongo().database;
    const docs = await db.collection('points').find({ area }).project({ user_id: 1, points: 1, reports_count: 1, shifts_count: 1 }).toArray();
    return (docs as any).sort(sort);
}
function areaAccent(area: string) {
    const a = area.toLowerCase();
    if (a === 'suporte')
        return { primary: '#5865F2', secondary: '#E3E7FF' };
    if (a === 'design')
        return { primary: '#e67e22', secondary: '#ffe4cc' };
    if (a === 'movcall')
        return { primary: '#1abc9c', secondary: '#d8f7f1' };
    if (a === 'recrutamento')
        return { primary: '#9b59b6', secondary: '#f2e5f9' };
    return { primary: '#2c3e50', secondary: '#ecf0f1' };
}
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
    try {
        const res = await fetch(url);
        if (!res.ok)
            return null;
        const arr = await res.arrayBuffer();
        return Buffer.from(arr);
    }
    catch {
        return null;
    }
}
function ensureSpace(doc: any, needed: number, pageNum: number) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
        addFooter(doc, pageNum);
        doc.addPage();
        return pageNum + 1;
    }
    return pageNum;
}
function addFooter(doc: any, pageNum: number) {
    doc.fontSize(8).fillColor('#888');
    const footerY = doc.page.height - doc.page.margins.bottom + 10;
    doc.text(`Página ${pageNum}`, doc.page.margins.left, footerY, { width: doc.page.width - doc.page.margins.left * 2, align: 'center' });
}
function addHeader(doc: any, area: string, primary: string, fonts: Fonts) {
    doc.font(fonts.bold).fontSize(14).fillColor(primary).text(`${area} · Continuação`, { align: 'center' });
    doc.moveDown(0.25);
    doc.save().rect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left * 2, 2).fill(primary).restore();
    doc.moveDown(0.5);
}
function median(values: number[]): number {
    if (!values.length)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function formatNumber(n: number) {
    return n.toLocaleString('pt-BR');
}
interface Fonts {
    regular: string;
    bold: string;
    medium: string;
}
function prepareFonts(doc: any): Fonts {
    const candidates: Record<keyof Fonts, string[]> = {
        regular: ['assets/fonts/Inter-Regular.ttf', 'assets/fonts/Roboto-Regular.ttf'],
        bold: ['assets/fonts/Inter-Bold.ttf', 'assets/fonts/Roboto-Bold.ttf'],
        medium: ['assets/fonts/Inter-Medium.ttf', 'assets/fonts/Roboto-Medium.ttf']
    };
    const resolved: Fonts = { regular: 'Helvetica', bold: 'Helvetica-Bold', medium: 'Helvetica' };
    (Object.keys(candidates) as (keyof Fonts)[]).forEach(k => {
        for (const p of candidates[k]) {
            if (existsSync(p)) {
                try {
                    doc.registerFont(p, p);
                    resolved[k] = p;
                }
                catch { }
                break;
            }
        }
    });
    return resolved;
}
export async function generateAreaPdf(client: Client, area: string): Promise<Buffer> {
    const rows = await fetchAreaRows(area);
    const { primary, secondary } = areaAccent(area);
    const doc = new PDFDocument({ margin: 40, info: { Title: `Relatório de Pontos - ${area}`, Author: 'Sistema' } });
    const out: Buffer[] = [];
    let pageNumber = 1;
    doc.on('data', (d: any) => out.push(d));
    const fonts = prepareFonts(doc);
    let version = 'unknown';
    try {
        const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
        version = pkg.version || version;
    }
    catch { }
    const contentWidth = doc.page.width - doc.page.margins.left * 2;
    doc.font(fonts.bold).fontSize(26).fillColor(primary).text(`Relatório de Pontos`, doc.page.margins.left, doc.y, { align: 'center', width: contentWidth });
    doc.moveDown(0.2);
    doc.font(fonts.medium).fontSize(18).fillColor('#222').text(area, doc.page.margins.left, doc.y, { align: 'center', width: contentWidth });
    doc.moveDown(0.5);
    doc.font(fonts.regular).fontSize(10).fillColor('#555').text(`Gerado em ${new Date().toLocaleString('pt-BR')}  |  Versão do Bot ${version}`, doc.page.margins.left, doc.y, { align: 'center', width: contentWidth });
    doc.moveDown(0.8);
    doc.save().rect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left * 2, 5).fill(primary).restore();
    doc.moveDown(1.2);
    if (!rows.length) {
        doc.font(fonts.regular).fontSize(14).fillColor('#777').text('Nenhum participante ainda.');
        addFooter(doc, pageNumber);
        doc.end();
        return await new Promise(res => doc.on('end', () => res(Buffer.concat(out))));
    }
    const totalPoints = rows.reduce((s, r) => s + (r.points || 0), 0);
    const avgPoints = totalPoints / rows.length;
    const medPoints = median(rows.map(r => r.points));
    const maxPoints = rows[0].points || 1;
    const suporte = area.toLowerCase() === 'suporte';
    doc.x = doc.page.margins.left;
    doc.font(fonts.bold).fontSize(16).fillColor(primary).text('Resumo', { width: contentWidth, align: 'left' });
    doc.moveDown(0.4);
    doc.fontSize(11).fillColor('#222');
    const summaryData = [
        ['Participantes', String(rows.length)],
        ['Total de Pontos', formatNumber(totalPoints)],
        ['Média', formatNumber(Math.round(avgPoints))],
        ['Mediana', formatNumber(Math.round(medPoints))],
        ['Maior Pontuação', formatNumber(maxPoints)],
    ];
    const col1w = 140;
    const startYSummary = doc.y;
    summaryData.forEach((line, i) => {
        const y = startYSummary + i * 16;
        doc.fillColor('#555').font(fonts.medium).fontSize(10).text(line[0] + ':', doc.page.margins.left, y, { width: col1w });
        doc.fillColor('#111').font(fonts.bold).fontSize(11).text(line[1], doc.page.margins.left + col1w, y);
    });
    doc.y = startYSummary + summaryData.length * 16 + 10;
    const topN = rows.slice(0, 10);
    doc.x = doc.page.margins.left;
    doc.font(fonts.bold).fontSize(16).fillColor(primary).text('Top 10', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
    doc.moveDown(0.4);
    const headerFontSize = 9;
    const tableX = doc.page.margins.left;
    const colWidths = suporte ? [32, 190, 70, 70, 85, 85] : [32, 240, 80, 80, 100];
    const headers = suporte ? ['Pos', 'Usuário', 'Pontos', '% Total', 'Relatórios', 'Plantões'] : ['Pos', 'Usuário', 'Pontos', '% Total', 'Participação'];
    const tableStartY = doc.y;
    doc.save();
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    doc.roundedRect(tableX, tableStartY, tableWidth, 22, 6).fill(secondary);
    doc.fillColor('#111').font(fonts.medium).fontSize(headerFontSize);
    let cursorX = tableX + 8;
    let headerY = tableStartY + 7;
    headers.forEach((h, i) => {
        const w = colWidths[i];
        doc.text(h, cursorX, headerY, { width: w - 16, align: i === 0 ? 'left' : 'center' });
        cursorX += w;
    });
    doc.restore();
    let rowY = tableStartY + 22;
    for (let i = 0; i < topN.length; i++) {
        const r = topN[i];
        pageNumber = ensureSpace(doc, 30, pageNumber);
        const pctTotal = totalPoints ? (r.points / totalPoints * 100) : 0;
        const partPct = (r.points / maxPoints) * 100;
        const user = await client.users.fetch(r.user_id).catch(() => null);
        let display = user ? user.username : r.user_id;
        doc.save();
        if (i % 2 === 1) {
            doc.rect(tableX, rowY, colWidths.reduce((a, b) => a + b, 0), 20).fill('#ffffff');
        }
        doc.restore();
        cursorX = tableX + 8;
        const baseY = rowY + 6;
        const rowValues = suporte
            ? [String(i + 1), display, formatNumber(r.points), pctTotal.toFixed(1) + '%', String(r.reports_count || 0), String(r.shifts_count || 0)]
            : [String(i + 1), display, formatNumber(r.points), pctTotal.toFixed(1) + '%', partPct.toFixed(1) + '% do líder'];
        rowValues.forEach((val, idx) => {
            const w = colWidths[idx];
            let align: 'left' | 'center' = 'center';
            let textX = cursorX;
            if (idx === 0) {
                align = 'left';
                textX += 4;
            }
            else if (idx === 1) {
                align = 'left';
                textX += 8;
            }
            doc.font(fonts.regular).fontSize(9).fillColor('#222').text(val, textX, baseY, { width: w - 16, align, ellipsis: true });
            cursorX += w;
        });
        rowY += 20;
        doc.y = rowY;
    }
    doc.moveDown(1);
    doc.font(fonts.regular).fontSize(9).fillColor('#555').text('Tabela rápida – detalhes completos a seguir.', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
    const cardHeightRef = suporte ? 120 : 108;
    const perCardExtra = 20;
    const titleBlock = 40;
    const minCardsHere = 3;
    const requiredForThree = titleBlock + (cardHeightRef + perCardExtra) * minCardsHere;
    const remainingSpace = doc.page.height - doc.page.margins.bottom - doc.y;
    if (remainingSpace < requiredForThree) {
        addFooter(doc, pageNumber);
        doc.addPage();
        pageNumber++;
    }
    doc.moveDown(0.4);
    doc.x = doc.page.margins.left;
    doc.font(fonts.bold).fontSize(18).fillColor(primary).text('Detalhamento', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
    doc.moveDown(0.6);
    let position = 0;
    const medalColors = ['#D4AF37', '#C0C0C0', '#CD7F32'];
    let cardsOnCurrentPage = 0;
    const maxCardsPerPage = 4;
    for (const r of rows) {
        const cardHeight = suporte ? 120 : 108;
        const cardWithMargin = cardHeight + 20;
        const spaceNeeded = cardWithMargin + (position === 0 ? 30 : 0);
        const currentSpace = doc.page.height - doc.page.margins.bottom - doc.y;
        if (cardsOnCurrentPage === 0) {
            const spaceForTwo = spaceNeeded + cardWithMargin;
            if (currentSpace < spaceForTwo) {
                addFooter(doc, pageNumber);
                doc.addPage();
                pageNumber++;
                addHeader(doc, area, primary, fonts);
                doc.x = doc.page.margins.left;
                doc.font(fonts.bold).fontSize(18).fillColor(primary).text('Detalhamento', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
                doc.moveDown(0.6);
            }
        }
        if (cardsOnCurrentPage >= maxCardsPerPage || currentSpace < spaceNeeded) {
            addFooter(doc, pageNumber);
            doc.addPage();
            pageNumber++;
            cardsOnCurrentPage = 0;
            addHeader(doc, area, primary, fonts);
            doc.x = doc.page.margins.left;
            doc.font(fonts.bold).fontSize(18).fillColor(primary).text('Detalhamento', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
            doc.moveDown(0.6);
        }
        const idx = ++position;
        const startY = doc.y;
        doc.save();
        const cardColor = idx % 2 === 0 ? '#FFFFFF' : secondary;
        doc.roundedRect(doc.page.margins.left, startY, doc.page.width - doc.page.margins.left * 2, cardHeight, 10).fill(cardColor);
        if (idx <= 3) {
            doc.lineWidth(2).roundedRect(doc.page.margins.left, startY, doc.page.width - doc.page.margins.left * 2, cardHeight, 10).stroke(medalColors[idx - 1]);
        }
        doc.restore();
        if (idx === 1) {
            const ribbonWidth = 170;
            const ribbonHeight = 26;
            const cardRight = doc.page.margins.left + contentWidth;
            const ribbonX = cardRight - ribbonWidth - 14;
            const ribbonY = startY - 14;
            doc.save();
            doc.roundedRect(ribbonX, ribbonY, ribbonWidth, ribbonHeight, 8).fill('#9B59B6');
            doc.fillColor('#FFFFFF').font(fonts.bold).fontSize(11).text('Staff Sensação', ribbonX, ribbonY + 6, { width: ribbonWidth, align: 'center' });
            doc.restore();
        }
        const badgeX = doc.page.margins.left + 12;
        const badgeY = startY + 12;
        doc.save();
        const circleColor = idx <= 3 ? medalColors[idx - 1] : primary;
        doc.circle(badgeX + 18, badgeY + 18, 18).fill(circleColor);
        doc.fillColor('#fff').font(fonts.bold).fontSize(15).text(String(idx), badgeX + 6, badgeY + 8, { width: 24, align: 'center' });
        doc.restore();
        const user = await client.users.fetch(r.user_id).catch(() => null);
        let avatarDrawn = false;
        if (user) {
            const av = user.displayAvatarURL({ size: 128, extension: 'png' } as any);
            const buf = await fetchImageBuffer(av);
            if (buf) {
                try {
                    doc.save().circle(badgeX + 85, badgeY + 45, 36).clip().image(buf, badgeX + 49, badgeY + 9, { width: 72, height: 72 }).restore();
                    avatarDrawn = true;
                }
                catch { }
            }
        }
        if (!avatarDrawn) {
            doc.save().circle(badgeX + 85, badgeY + 45, 36).fill('#ccc').restore();
            doc.fillColor('#666').fontSize(10).text('Sem foto', badgeX + 67, badgeY + 40, { width: 36, align: 'center' });
        }
        const infoX = badgeX + 140;
        let cursorY = badgeY + 2;
        const display = user ? user.username : r.user_id;
        doc.fillColor('#111').font(fonts.bold).fontSize(14).text(display, infoX, cursorY, { width: contentWidth - (infoX - doc.page.margins.left) - 20, ellipsis: true });
        cursorY += 20;
        doc.font(fonts.regular).fontSize(8).fillColor('#666').text(`ID: ${r.user_id}`, infoX, cursorY);
        cursorY += 12;
        doc.font(fonts.medium).fontSize(11).fillColor(primary).text(`Pontos: ${formatNumber(r.points)}`, infoX, cursorY);
        cursorY += 16;
        const pctTotal = totalPoints ? (r.points / totalPoints * 100) : 0;
        doc.font(fonts.regular).fontSize(8).fillColor('#333').text(`Participação no total: ${pctTotal.toFixed(2)}%`, infoX, cursorY);
        cursorY += 12;
        if (suporte) {
            doc.font(fonts.regular).fontSize(8).fillColor('#333').text(`Relatórios: ${r.reports_count || 0}  •  Plantões: ${r.shifts_count || 0}`, infoX, cursorY);
            cursorY += 12;
        }
        doc.y = startY + cardHeight + 14;
        cardsOnCurrentPage++;
    }
    addFooter(doc, pageNumber);
    doc.end();
    return await new Promise<Buffer>(res => doc.on('end', () => res(Buffer.concat(out))));
}
