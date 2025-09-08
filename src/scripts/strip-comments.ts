import fs from 'fs/promises';
import path from 'path';
import * as ts from 'typescript';
interface StatResult {
    files: number;
    changed: number;
    bytesSaved: number;
}
;
const ROOT = path.resolve(process.cwd());
const INCLUDE_DIRS = ['src', 'tests'];
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', '.git', 'data']);
const VALID_EXT = new Set(['.ts', '.js', '.mjs', '.cjs']);
const isDry = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
async function gatherFiles(dir: string, acc: string[]) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        if (e.name.startsWith('.'))
            continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (EXCLUDE_DIRS.has(e.name))
                continue;
            await gatherFiles(full, acc);
        }
        else {
            const ext = path.extname(e.name);
            if (VALID_EXT.has(ext))
                acc.push(full);
        }
    }
}
function stripFileContent(code: string, filePath: string): string {
    const sf = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
    const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
    return printer.printFile(sf);
}
async function processFile(file: string, stats: StatResult) {
    stats.files++;
    const original = await fs.readFile(file, 'utf8');
    const stripped = stripFileContent(original, file);
    if (stripped !== original) {
        stats.changed++;
        stats.bytesSaved += Math.max(0, original.length - stripped.length);
        if (!isDry) {
            await fs.writeFile(file, stripped, 'utf8');
        }
    }
}
async function main() {
    const stats: StatResult = { files: 0, changed: 0, bytesSaved: 0 };
    const targets: string[] = [];
    for (const dir of INCLUDE_DIRS) {
        const full = path.join(ROOT, dir);
        try {
            await fs.access(full);
        }
        catch {
            continue;
        }
        await gatherFiles(full, targets);
    }
    targets.sort();
    for (const f of targets) {
        try {
            await processFile(f, stats);
        }
        catch (err) {
            console.error('[strip-comments] Erro em', f, err);
        }
    }
    const summary = `[strip-comments] Arquivos analisados: ${stats.files} | Modificados: ${stats.changed} | Bytes economizados: ${stats.bytesSaved}${isDry ? ' (dry-run)' : ''}`;
    console.log(summary);
    if (isDry) {
        console.log('Use sem --dry-run / DRY_RUN=1 para aplicar as alterações.');
    }
}
main().catch(e => {
    console.error('[strip-comments] Falha geral:', e);
    process.exitCode = 1;
});
