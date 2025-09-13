import fs from 'node:fs';
import path from 'node:path';
import { ConfigRoot, validateConfig } from './schema.ts';
let cached: ConfigRoot | null = null;
function stripJsonComments(raw: string) {
    let withoutBlocks = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    return withoutBlocks.split(/\n/).map(line => {
        let inString = false;
        let escaped = false;
        let out = '';
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (!escaped && ch === '"')
                inString = !inString;
            if (!inString && ch === '/' && line[i + 1] === '/') {
                break;
            }
            escaped = (!escaped && ch === '\\');
            out += ch;
        }
        return out;
    }).join('\n');
}
export function loadConfig(): ConfigRoot {
    if (cached)
        return cached;
    const file = process.env.BOT_CONFIG_FILE || path.join(process.cwd(), 'src', 'config', 'bot-config.json');
    let raw = fs.readFileSync(file, 'utf8');
    if (/\/\//.test(raw) || /\/\*/.test(raw)) {
        raw = stripJsonComments(raw);
    }
    const parsed = JSON.parse(raw);
    cached = validateConfig(parsed);
    try {
        const issues: string[] = [];
        if (!(cached as any).areas || !(cached as any).areas.length)
            issues.push('Nenhuma área configurada.');
        const dupGuilds = new Map<string, number>();
        for (const a of (cached as any).areas || []) {
            if (!a.guildId)
                issues.push(`Área ${a.name} sem guildId`);
            if (a.guildId)
                dupGuilds.set(a.guildId, (dupGuilds.get(a.guildId) || 0) + 1);
        }
        [...dupGuilds.entries()].filter(([, c]) => c > 1).forEach(([g]) => issues.push(`Guild repetido em múltiplas áreas: ${g}`));
        if (issues.length) {
            console.warn('[CONFIG VALIDATION]', issues.join(' | '));
        }
    }
    catch { }
    return cached;
}
export function getAreaByName(name: string) {
    const cfg = loadConfig();
    return cfg.areas.find(a => a.name.toLowerCase() === name.toLowerCase());
}
export function reloadConfig() { cached = null; return loadConfig(); }
function isValidId(id?: string) { return !!id && !/^0+$/.test(id); }
export function resolvePrimaryGuildId(): string | undefined {
    const cfg = loadConfig();
    if (isValidId(cfg.mainGuildId))
        return cfg.mainGuildId;
    const support = (cfg as any).support?.guildId;
    if (isValidId(support))
        return support;
    if (cfg.banca?.supportGuildId && isValidId(cfg.banca.supportGuildId))
        return cfg.banca.supportGuildId;
    const area = cfg.areas.find(a => isValidId(a.guildId));
    return area?.guildId;
}
