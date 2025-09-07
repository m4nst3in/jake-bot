// @ts-ignore - tipos de pdfkit não instalados
import PDFDocument from 'pdfkit';
import { Client } from 'discord.js';
import { DatabaseManager } from '../db/manager.ts';
import { loadConfig } from '../config/index.ts';

interface MemberRow { user_id: string; points: number; reports_count: number; shifts_count: number; }

async function fetchAreaRows(area: string): Promise<MemberRow[]> {
  const sort = (a:MemberRow,b:MemberRow)=> b.points - a.points;
  if (DatabaseManager.current === 'sqlite') {
    const db = DatabaseManager.getSqlite().connection;
    const rows: any[] = await new Promise((resolve,reject)=>{
      db.all('SELECT user_id, points, reports_count, shifts_count FROM points WHERE area=?',[area], (err:Error|null,r:any[])=> err?reject(err):resolve(r));
    });
    return rows.sort(sort);
  }
  const db = DatabaseManager.getMongo().database;
  const docs = await db.collection('points').find({ area }).project({ user_id:1, points:1, reports_count:1, shifts_count:1 }).toArray();
  return (docs as any).sort(sort);
}

function areaAccent(area: string){
  const a = area.toLowerCase();
  if (a==='suporte') return { primary:'#5865F2', secondary:'#E3E7FF' };
  if (a==='design') return { primary:'#e67e22', secondary:'#ffe4cc' };
  if (a==='movcall') return { primary:'#1abc9c', secondary:'#d8f7f1' };
  if (a==='recrutamento') return { primary:'#9b59b6', secondary:'#f2e5f9' };
  return { primary:'#2c3e50', secondary:'#ecf0f1' };
}

async function fetchImageBuffer(url: string): Promise<Buffer|null>{
  try { const res = await fetch(url); if(!res.ok) return null; const arr = await res.arrayBuffer(); return Buffer.from(arr); } catch { return null; }
}

function ensureSpace(doc: PDFDocument, needed: number){
  if (doc.y + needed > doc.page.height - doc.page.margins.bottom) doc.addPage();
}

export async function generateAreaPdf(client: Client, area: string): Promise<Buffer> {
  const rows = await fetchAreaRows(area);
  const { primary, secondary } = areaAccent(area);
  const doc = new PDFDocument({ margin: 40, info: { Title: `Relatório de Pontos - ${area}`, Author: 'Sistema' } });
  const out: Buffer[] = [];
  doc.on('data', (d:any)=> out.push(d));
  doc.fontSize(26).fillColor(primary).text(`Relatório de Pontos · ${area}`, { align:'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor('#555').text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align:'center' });
  doc.moveDown(0.5);
  // Barra decorativa
  doc.save().rect(doc.page.margins.left, doc.y, doc.page.width - doc.page.margins.left*2, 4).fill(primary).restore();
  doc.moveDown(1.2);

  if (!rows.length){
    doc.fontSize(14).fillColor('#777').text('Nenhum participante ainda.');
    doc.end();
    return await new Promise(res=> doc.on('end', ()=> res(Buffer.concat(out))));
  }

  const suporte = area.toLowerCase()==='suporte';
  let position = 0;

  for (const r of rows){
    ensureSpace(doc, 130);
    const idx = ++position;
    const startY = doc.y;
    const cardHeight = suporte ? 115 : 100;
    // Card background
    doc.save();
    doc.roundedRect(doc.page.margins.left, startY, doc.page.width - doc.page.margins.left*2, cardHeight, 8)
      .fill(idx %2 ===0 ? '#FFFFFF' : secondary);
    doc.restore();

    // Rank badge
    const badgeX = doc.page.margins.left + 10;
    const badgeY = startY + 10;
    doc.save();
    doc.circle(badgeX+15, badgeY+15, 15).fill(primary);
    doc.fillColor('#fff').fontSize(14).text(String(idx), badgeX+5, badgeY+7, { width:20, align:'center' });
    doc.restore();

    // Avatar
    const user = await client.users.fetch(r.user_id).catch(()=>null);
    let avatarDrawn = false;
    if (user){
      const av = user.displayAvatarURL({ size:128, extension:'png' } as any);
      const buf = await fetchImageBuffer(av);
      if (buf){
        try { doc.save().circle(badgeX+70, badgeY+35, 32).clip().image(buf, badgeX+38, badgeY+3, { width:64, height:64 }).restore(); avatarDrawn = true; } catch {}
      }
    }
    if (!avatarDrawn){
      doc.save().circle(badgeX+70, badgeY+35, 32).fill('#ccc').restore();
  doc.fillColor('#666').fontSize(10).text('SEM AVATAR', badgeX+54, badgeY+28, { width:32, align:'center' });
    }

    // User info
    const infoX = badgeX + 120;
    let cursorY = badgeY;
    const display = user ? (user.globalName || user.username) : r.user_id;
    doc.fillColor('#111').fontSize(14).text(display, infoX, cursorY, { width: 300 });
    cursorY += 20;
    doc.fontSize(9).fillColor('#555').text(`ID: ${r.user_id}`, infoX, cursorY);
    cursorY += 14;
    doc.fontSize(11).fillColor(primary).text(`Pontos: ${r.points}`, infoX, cursorY);
    cursorY += 16;
    if (suporte){
      doc.fontSize(10).fillColor('#333').text(`Relatórios: ${r.reports_count || 0}  •  Plantões: ${r.shifts_count || 0}`, infoX, cursorY);
      cursorY += 16;
    }

    // Progress bar (visual) relative to max points
    const maxPoints = rows[0].points || 1;
    const barWidth = 250;
    const pct = Math.max(0, Math.min(1, r.points / maxPoints));
    const barX = infoX; const barY = startY + cardHeight - 25;
    doc.save();
    doc.roundedRect(barX, barY, barWidth, 10, 5).fill('#e0e0e0');
    doc.roundedRect(barX, barY, Math.max(4, barWidth * pct), 10, 5).fill(primary);
    doc.restore();
    doc.fontSize(8).fillColor('#444').text(`${(pct*100).toFixed(1)}% do líder`, barX + barWidth + 8, barY - 1);

    doc.y = startY + cardHeight + 12;
  }

  doc.end();
  return await new Promise<Buffer>(res=> doc.on('end', ()=> res(Buffer.concat(out))));
}
