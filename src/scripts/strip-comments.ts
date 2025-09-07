import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'src');
const exts = new Set(['.ts', '.js', '.json', '.jsonc']);
const preservePatterns = [ /eslint-disable/ ];

function stripComments(code: string){

  const protectedLines = new Set<number>();
  const lines = code.split('\n');
  lines.forEach((l,i)=>{
    if(preservePatterns.some(r=>r.test(l))) protectedLines.add(i);
  });
  let out = code;

  out = out.replace(/\/\*[\s\S]*?\*\//g, (m, offset)=>{

    if(preservePatterns.some(r=>r.test(m))) return m; return '';
  });

  out = out.split('\n').map((line, idx)=>{
    if(protectedLines.has(idx)) return line;
    let inSingle = false, inDouble = false, inTemplate=false, escape=false;
    for(let i=0;i<line.length;i++){
      const ch = line[i];
      if(escape){ escape=false; continue; }
      if(ch==='\\') { escape=true; continue; }
      if(ch==='"' && !inSingle && !inTemplate) inDouble = !inDouble;
      else if(ch==='\'' && !inDouble && !inTemplate) inSingle = !inSingle;
      else if(ch==='`' && !inSingle && !inDouble) inTemplate = !inTemplate;
      else if(ch==='/' && !inSingle && !inDouble && !inTemplate){
        if(line[i+1]==='/'){ return line.slice(0,i).trimEnd(); }
      }
    }
    return line;
  }).join('\n');

  out = out.replace(/\n{3,}/g,'\n\n');
  return out.trimEnd()+"\n";
}

function walk(dir: string){
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for(const e of entries){
    if(e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if(e.isDirectory()) walk(full);
    else {
      const ext = path.extname(e.name);
      if(!exts.has(ext)) continue;
      const original = fs.readFileSync(full,'utf8');
      const stripped = stripComments(original);
      if(stripped !== original){
        fs.writeFileSync(full, stripped, 'utf8');
        console.log('Stripped', path.relative(process.cwd(), full));
      }
    }
  }
}

walk(ROOT);
console.log('Comment stripping complete.');
