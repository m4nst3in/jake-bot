import PDFDocument from 'pdfkit';
import { Client, GuildMember } from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { DatabaseManager } from '../db/manager.ts';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

// Constants for better maintainability
const PDF_CONFIG = {
    MARGIN: 40,
    COLORS: {
        PRIMARY_TEXT: '#111111',
        SECONDARY_TEXT: '#555555',
        MUTED_TEXT: '#888888',
        SUCCESS: '#1abc9c',
        ERROR: '#e74c3c',
        WARNING: '#f39c12'
    },
    FONTS: {
        TITLE: 26,
        SUBTITLE: 18,
        SECTION_HEADER: 16,
        CARD_TITLE: 14,
        BODY: 11,
        SMALL: 9,
        TINY: 8
    },
    SPACING: {
        SECTION: 1.2,
        CARD: 0.6,
        LINE: 0.4
    },
    CARD: {
        HEIGHT: 120,
        HEIGHT_SUPORTE: 120,
        MARGIN: 20,
        RADIUS: 10,
        MAX_PER_PAGE: 4
    }
};
interface MemberRow {
    user_id: string;
    points: number;
    reports_count: number;
    shifts_count: number;
    rankName?: string;
}
async function fetchAreaRows(client: Client, area: string): Promise<MemberRow[]> {
    const sort = (a: MemberRow, b: MemberRow) => b.points - a.points;
    let rows: MemberRow[] = [];
    if (DatabaseManager.current === 'sqlite') {
        const db = DatabaseManager.getSqlite().connection;
        const dbRows: any[] = await new Promise((resolve, reject) => {
            db.all('SELECT user_id, points, reports_count, shifts_count FROM points WHERE area=?', [area], (err: Error | null, r: any[]) => err ? reject(err) : resolve(r));
        });
        rows = dbRows as any;
    }
    else {
        const db = DatabaseManager.getMongo().database;
        const docs = await db.collection('points').find({ area }).project({ user_id: 1, points: 1, reports_count: 1, shifts_count: 1 }).toArray();
        rows = docs as any;
    }
    try {
        const cfg: any = loadConfig();
        let mainGuild: any = null;
        if (cfg.mainGuildId) {
            mainGuild = client.guilds.cache.get(cfg.mainGuildId) || await client.guilds.fetch(cfg.mainGuildId).catch(() => null);
            if (mainGuild) {
                await mainGuild.members.fetch();
            }
        }
        const areaCfg = (cfg.areas || []).find((a: any) => a.name.toLowerCase() === area.toLowerCase());
        if (areaCfg?.guildId && areaCfg?.roleIds?.member) {
            const g = client.guilds.cache.get(areaCfg.guildId) || await client.guilds.fetch(areaCfg.guildId).catch(() => null);
            if (g) {
                await g.members.fetch();
                rows = rows.filter(r => g.members.cache.has(r.user_id));
                const memberRoleId = areaCfg.roleIds.member;
                const leadRoleId = areaCfg.roleIds.lead;
                const owners: string[] = cfg.owners || [];
                const alwaysShow: string[] = (cfg.ranking?.alwaysShowOwnerIds) || [];
                const existing = new Set(rows.map(r => r.user_id));
                rows = rows.filter(r => {
                    const m = g.members.cache.get(r.user_id);
                    if (!m)
                        return false;
                    if (owners.includes(r.user_id))
                        return false;
                    if (leadRoleId && m.roles.cache.has(leadRoleId))
                        return false;
                    return true;
                });
                g.members.cache.forEach(m => {
                    if (!m.roles.cache.has(memberRoleId))
                        return;
                    const rec = rows.find(r => r.user_id === m.id);
                    const hasPoints = !!rec && rec.points > 0;
                    if (!hasPoints) {
                        if (leadRoleId && m.roles.cache.has(leadRoleId))
                            return;
                        if (owners.includes(m.id))
                            return;
                    }
                    if (!existing.has(m.id)) {
                        rows.push({ user_id: m.id, points: 0, reports_count: 0, shifts_count: 0 });
                        existing.add(m.id);
                    }
                });
                rows = rows.filter(r => {
                    const m = g.members.cache.get(r.user_id);
                    if (!m)
                        return false;
                    if (owners.includes(r.user_id))
                        return false;
                    if (leadRoleId && m.roles.cache.has(leadRoleId))
                        return false;
                    return true;
                });
            }
        }
        if (mainGuild) {
            const hierarchy: string[] = cfg.hierarchyOrder || [];
            const roleNameById: Record<string, string> = {};
            Object.entries(cfg.roles || {}).forEach(([name, id]) => roleNameById[id as string] = name);
            rows.forEach(r => {
                const member: GuildMember | undefined = mainGuild.members.cache.get(r.user_id);
                if (!member)
                    return;
                let found: string | undefined;
                for (let i = hierarchy.length - 1; i >= 0; i--) {
                    const rankName = hierarchy[i];
                    const roleId = (cfg.roles || {})[rankName];
                    if (roleId && member.roles.cache.has(roleId)) {
                        found = rankName;
                        break;
                    }
                }
                r.rankName = found;
            });
        }
    }
    catch { }
    return rows.sort(sort);
}
interface AreaTheme {
    primary: string;
    secondary: string;
    accent: string;
    name: string;
    icon: string;
}

/**
 * Get area-specific color scheme with improved contrast and accessibility
 */
function getAreaTheme(area: string): AreaTheme {
    const themes: Record<string, AreaTheme> = {
        suporte: { 
            primary: '#5865F2', 
            secondary: '#E3E7FF', 
            accent: '#4752C4',
            name: 'Suporte',
            icon: '🛠️'
        },
        design: { 
            primary: '#e67e22', 
            secondary: '#ffe4cc', 
            accent: '#d35400',
            name: 'Design',
            icon: '🎨'
        },
        movcall: { 
            primary: '#1abc9c', 
            secondary: '#d8f7f1', 
            accent: '#16a085',
            name: 'MovCall',
            icon: '📞'
        },
        recrutamento: { 
            primary: '#9b59b6', 
            secondary: '#f2e5f9', 
            accent: '#8e44ad',
            name: 'Recrutamento',
            icon: '👥'
        },
        eventos: {
            primary: '#f39c12',
            secondary: '#fef5e7',
            accent: '#e67e22',
            name: 'Eventos',
            icon: '🎉'
        },
        jornalismo: {
            primary: '#34495e',
            secondary: '#ecf0f1',
            accent: '#2c3e50',
            name: 'Jornalismo',
            icon: '📰'
        }
    };
    
    return themes[area.toLowerCase()] || {
        primary: '#2c3e50', 
        secondary: '#ecf0f1', 
        accent: '#34495e',
        name: area,
        icon: '📊'
    };
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
function ensureSpace(doc: any, needed: number, pageNum: number, theme: AreaTheme) {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
        addFooter(doc, pageNum, theme);
        doc.addPage();
        return pageNum + 1;
    }
    return pageNum;
}
/**
 * Add a styled footer with page number and branding
 */
function addFooter(doc: any, pageNum: number, theme: AreaTheme) {
    const footerY = doc.page.height - doc.page.margins.bottom + 10;
    const contentWidth = doc.page.width - doc.page.margins.left * 2;
    
    // Subtle line above footer
    doc.save()
       .rect(doc.page.margins.left, footerY - 5, contentWidth, 1)
       .fill('#e0e0e0')
       .restore();
    
    // Page number with styling
    doc.fontSize(PDF_CONFIG.FONTS.TINY)
       .fillColor(PDF_CONFIG.COLORS.MUTED_TEXT)
       .text(
           `Página ${pageNum} • Gerado pelo Sistema de Relatórios`,
           doc.page.margins.left,
           footerY,
           { width: contentWidth, align: 'center' }
       );
}
/**
 * Add a styled header for continuation pages
 */
function addHeader(doc: any, theme: AreaTheme, fonts: Fonts) {
    const contentWidth = doc.page.width - doc.page.margins.left * 2;
    
    // Area name with icon
    doc.font(fonts.bold)
       .fontSize(PDF_CONFIG.FONTS.SECTION_HEADER)
       .fillColor(theme.primary)
       .text(`${theme.icon} ${theme.name} · Continuação`, {
           align: 'center',
           width: contentWidth
       });
    
    doc.moveDown(PDF_CONFIG.SPACING.LINE);
    
    // Decorative line with gradient effect
    doc.save()
       .rect(doc.page.margins.left, doc.y, contentWidth, 3)
       .fill(theme.primary)
       .restore();
    
    doc.moveDown(PDF_CONFIG.SPACING.CARD);
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
    const rows = await fetchAreaRows(client, area);
    interface RankGoal {
        name: string;
        period: string;
        points?: number;
        reports?: number;
        upPoints?: number;
        maintainPoints?: number;
    }
    type AreaGoals = {
        ranks: RankGoal[];
        maintain?: any;
    };
    let metas: Record<string, AreaGoals> = {};
    const metasRankIndex: Record<string, Record<string, RankGoal>> = {};
    const normalizeRank = (n?: string) => (n || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/º|°/g, '')
        .replace(/terceir[oa]/g, '3')
        .replace(/segund[oa]/g, '2')
        .replace(/primeir[oa]/g, '1')
        .replace(/\bcapitao\b/g, 'capitan')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    try {
        const metasPath = path.resolve('src/config/metas.json');
        const raw = readFileSync(metasPath, 'utf8');
        metas = JSON.parse(raw);
        Object.entries(metas).forEach(([areaKey, data]: [
            string,
            any
        ]) => {
            const idx: Record<string, RankGoal> = {};
            (data.ranks || []).forEach((rg: any) => {
                const base = normalizeRank(rg.name);
                idx[base] = rg;
                const wordVariant = base
                    .replace(/\b1\b/g, 'primeiro')
                    .replace(/\b2\b/g, 'segundo')
                    .replace(/\b3\b/g, 'terceiro');
                if (!idx[wordVariant])
                    idx[wordVariant] = rg;
            });
            metasRankIndex[areaKey.toLowerCase()] = idx;
        });
    }
    catch { }
    const theme = getAreaTheme(area);
    const doc = new PDFDocument({ 
        margin: PDF_CONFIG.MARGIN, 
        info: { 
            Title: `Relatório de Pontos - ${theme.name}`, 
            Author: 'Sistema de Relatórios',
            Subject: `Análise de desempenho da equipe ${theme.name}`,
            Keywords: 'relatório, pontos, equipe, desempenho'
        } 
    });
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
    // Enhanced title section with better typography
    doc.font(fonts.bold)
       .fontSize(PDF_CONFIG.FONTS.TITLE)
       .fillColor(theme.primary)
       .text(`${theme.icon} Relatório de Pontos`, doc.page.margins.left, doc.y, { 
           align: 'center', 
           width: contentWidth 
       });
    
    doc.moveDown(0.3);
    
    doc.font(fonts.medium)
       .fontSize(PDF_CONFIG.FONTS.SUBTITLE)
       .fillColor(PDF_CONFIG.COLORS.PRIMARY_TEXT)
       .text(theme.name, doc.page.margins.left, doc.y, { 
           align: 'center', 
           width: contentWidth 
       });
    
    doc.moveDown(0.6);
    
    // Metadata section with better formatting
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('pt-BR');
    
    doc.font(fonts.regular)
       .fontSize(PDF_CONFIG.FONTS.SMALL)
       .fillColor(PDF_CONFIG.COLORS.SECONDARY_TEXT)
       .text(
           `Gerado em ${dateStr} às ${timeStr}  •  Versão ${version}`,
           doc.page.margins.left,
           doc.y,
           { align: 'center', width: contentWidth }
       );
    
    doc.moveDown(0.8);
    
    // Enhanced decorative line with gradient effect
    doc.save()
       .rect(doc.page.margins.left, doc.y, contentWidth, 4)
       .fill(theme.primary)
       .restore();
    
    doc.save()
       .rect(doc.page.margins.left, doc.y + 4, contentWidth, 1)
       .fill(theme.accent)
       .restore();
    
    doc.moveDown(PDF_CONFIG.SPACING.SECTION);
    if (!rows.length) {
        doc.font(fonts.regular).fontSize(14).fillColor('#777').text('Nenhum participante ainda.');
        addFooter(doc, pageNumber, theme);
        doc.end();
        return await new Promise(res => doc.on('end', () => res(Buffer.concat(out))));
    }
    const totalPoints = rows.reduce((s, r) => s + (r.points || 0), 0);
    const avgPoints = totalPoints / rows.length;
    const medPoints = median(rows.map(r => r.points));
    const maxPoints = rows[0].points || 1;
    const areaKey = area.toLowerCase();
    const suporte = areaKey === 'suporte';
    doc.x = doc.page.margins.left;
    doc.font(fonts.bold).fontSize(PDF_CONFIG.FONTS.SECTION_HEADER).fillColor(theme.primary).text('📊 Resumo Executivo', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
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
    doc.font(fonts.bold).fontSize(PDF_CONFIG.FONTS.SECTION_HEADER).fillColor(theme.primary).text('🏆 Top 10 Participantes', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
    doc.moveDown(0.4);
    const headerFontSize = 9;
    const tableX = doc.page.margins.left;
    const colWidths = suporte ? [32, 190, 70, 70, 85, 85] : [32, 240, 80, 80, 100];
    const headers = suporte ? ['Pos', 'Usuário', 'Pontos', '% Total', 'Relatórios', 'Plantões'] : ['Pos', 'Usuário', 'Pontos', '% Total', 'Participação'];
    const tableStartY = doc.y;
    doc.save();
    const tableWidth = colWidths.reduce((a, b) => a + b, 0);
    doc.roundedRect(tableX, tableStartY, tableWidth, 22, 6).fill(theme.secondary);
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
        pageNumber = ensureSpace(doc, 30, pageNumber, theme);
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
        addFooter(doc, pageNumber, theme);
        doc.addPage();
        pageNumber++;
    }
    doc.moveDown(0.4);
    doc.x = doc.page.margins.left;
    doc.font(fonts.bold).fontSize(PDF_CONFIG.FONTS.SUBTITLE).fillColor(theme.primary).text('📋 Análise Detalhada', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
    doc.moveDown(0.6);
    let position = 0;
    const medalColors = ['#D4AF37', '#C0C0C0', '#CD7F32'];
    let cardsOnCurrentPage = 0;
    const maxCardsPerPage = 4;
    const cfg: any = loadConfig();
    const isSuporte = areaKey === 'suporte';
    const passEmoji = '✅';
    const failEmoji = '❌';
    const SUPPORT_PLANTOES_META = 4;
    const areaRankGoals = metasRankIndex[areaKey] || {};
    function evaluate(r: MemberRow) {
        const rnNorm = normalizeRank(r.rankName);
        const g = areaRankGoals[rnNorm];
        if (areaKey === 'suporte') {
            const pointGoal = g?.points ?? 0;
            const reportsGoal = g?.reports;
            const hitPoints = pointGoal ? r.points >= pointGoal : true;
            const hitReports = reportsGoal !== undefined ? (r.reports_count || 0) >= reportsGoal : true;
            const hitShifts = (r.shifts_count || 0) >= SUPPORT_PLANTOES_META;
            const overallHit = hitPoints && hitReports && hitShifts;
            return { overallHit, hitPoints, hitReports, hitShifts, pointGoal, reportsGoal, shiftsGoal: SUPPORT_PLANTOES_META, g };
        }
        if (!g)
            return { overallHit: true, g: undefined };
        const threshold = g.upPoints ?? g.points ?? 0;
        const hitPoints = threshold ? r.points >= threshold : true;
        return { overallHit: hitPoints, g, threshold, hitPoints };
    }
    for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const cardHeight = suporte ? 120 : 108;
        const cardWithMargin = cardHeight + 20;
        const spaceNeeded = cardWithMargin + (position === 0 ? 30 : 0);
        const currentSpace = doc.page.height - doc.page.margins.bottom - doc.y;
        if (cardsOnCurrentPage === 0) {
            const spaceForTwo = spaceNeeded + cardWithMargin;
            if (currentSpace < spaceForTwo) {
                addFooter(doc, pageNumber, theme);
                doc.addPage();
                pageNumber++;
                addHeader(doc, theme, fonts);
                doc.x = doc.page.margins.left;
                doc.font(fonts.bold).fontSize(PDF_CONFIG.FONTS.SUBTITLE).fillColor(theme.primary).text('📋 Análise Detalhada', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
                doc.moveDown(0.6);
            }
        }
        if (cardsOnCurrentPage >= maxCardsPerPage || currentSpace < spaceNeeded) {
            addFooter(doc, pageNumber, theme);
            doc.addPage();
            pageNumber++;
            cardsOnCurrentPage = 0;
            addHeader(doc, theme, fonts);
            doc.x = doc.page.margins.left;
            doc.font(fonts.bold).fontSize(18).fillColor(theme.primary).text('Detalhamento', doc.page.margins.left, doc.y, { width: contentWidth, align: 'left' });
            doc.moveDown(0.6);
        }
        const idx = i + 1;
        position = idx;
        const startY = doc.y;
        doc.save();
        const cardColor = idx % 2 === 0 ? '#FFFFFF' : theme.secondary;
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
        const circleColor = idx <= 3 ? medalColors[idx - 1] : theme.primary;
        doc.circle(badgeX + 18, badgeY + 18, 18).fill(circleColor);
        doc.fillColor('#fff').font(fonts.bold).fontSize(15).text(String(idx), badgeX + 6, badgeY + 8, { width: 24, align: 'center' });
        doc.restore();
        const evalRes = evaluate(r);
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
        const rankLabel = r.rankName ? ` • ${r.rankName}` : '';
        try {
            const success = evalRes.overallHit;
            const badgeColor = success ? '#1abc9c' : '#e74c3c';
            const label = success ? 'META CUMPRIDA' : 'META NÃO CUMPRIDA';
            const cardRight = doc.page.margins.left + contentWidth;
            const badgeHeight = 22;
            const textWidth = doc.widthOfString(label);
            const badgeWidth = Math.min(Math.max(textWidth + 24, 90), 170);
            let badgeY = startY + 16;
            if (idx === 1)
                badgeY = startY + 44;
            const badgeX = cardRight - badgeWidth - 18;
            doc.save();
            doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 12).fill(badgeColor);
            doc.fillColor('#fff').font(fonts.bold).fontSize(10).text(label, badgeX, badgeY + 5, { width: badgeWidth, align: 'center' });
            doc.restore();
        }
        catch { }
        doc.font(fonts.medium).fontSize(PDF_CONFIG.FONTS.BODY).fillColor(theme.primary).text(`💎 Pontos: ${formatNumber(r.points)}${rankLabel}`, infoX, cursorY, { continued: false });
        cursorY += 16;
        const pctTotal = totalPoints ? (r.points / totalPoints * 100) : 0;
        doc.font(fonts.regular).fontSize(8).fillColor('#333').text(`Participação no total: ${pctTotal.toFixed(2)}%`, infoX, cursorY);
        cursorY += 12;
        if (areaKey === 'suporte') {
            if (evalRes.pointGoal !== undefined) {
                if (evalRes.hitPoints) {
                    doc.font(fonts.regular).fontSize(8).fillColor('#0a7').text(`Meta Pontos: ${evalRes.pointGoal} ok`, infoX, cursorY);
                }
                else {
                    const diff = Math.max(0, evalRes.pointGoal - r.points);
                    doc.font(fonts.regular).fontSize(8).fillColor('#b00').text(`Meta Pontos: ${evalRes.pointGoal} (faltam ${diff})`, infoX, cursorY);
                }
                cursorY += 12;
            }
            if (evalRes.reportsGoal !== undefined) {
                const have = r.reports_count || 0;
                const need: number = evalRes.reportsGoal ?? 0;
                const hit = evalRes.hitReports;
                const diff = Math.max(0, need - have);
                if (hit)
                    doc.font(fonts.regular).fontSize(8).fillColor('#0a7').text(`Relatórios: ${have}/${need} ok`, infoX, cursorY);
                else
                    doc.font(fonts.regular).fontSize(8).fillColor('#b00').text(`Relatórios: ${have}/${need} (faltam ${diff})`, infoX, cursorY);
                cursorY += 12;
            }
            {
                const have = r.shifts_count || 0;
                const need: number = evalRes.shiftsGoal ?? SUPPORT_PLANTOES_META;
                const hit = evalRes.hitShifts;
                const diff = Math.max(0, need - have);
                if (hit)
                    doc.font(fonts.regular).fontSize(8).fillColor('#0a7').text(`Plantões: ${have}/${need} ok`, infoX, cursorY);
                else
                    doc.font(fonts.regular).fontSize(8).fillColor('#b00').text(`Plantões: ${have}/${need} (faltam ${diff})`, infoX, cursorY);
                cursorY += 12;
            }
        }
        else if (evalRes.g) {
            const up = evalRes.g.upPoints ?? evalRes.g.points;
            if (up && up > 0) {
                if (!evalRes.overallHit) {
                    const diff = Math.max(0, up - r.points);
                    doc.font(fonts.regular).fontSize(8).fillColor('#b00').text(`Meta: ${up}${diff > 0 ? ` (faltam ${diff})` : ''}`, infoX, cursorY);
                    cursorY += 12;
                }
                else {
                    doc.font(fonts.regular).fontSize(8).fillColor('#0a7').text(`Meta: ${up} ok`, infoX, cursorY);
                    cursorY += 12;
                }
            }
        }
        doc.y = startY + cardHeight + 14;
        cardsOnCurrentPage++;
    }
    addFooter(doc, pageNumber, theme);
    doc.end();
    return await new Promise<Buffer>(res => doc.on('end', () => res(Buffer.concat(out))));
}
