import fs from 'node:fs';
import path from 'node:path';
import { ConfigRoot, validateConfig } from './schema.ts';
let cached: ConfigRoot | null = null;
export function loadConfig(): ConfigRoot {
    if (cached)
        return cached;
    const file = process.env.BOT_CONFIG_FILE || path.join(process.cwd(), 'src', 'config', 'bot-config.json');
    const raw = fs.readFileSync(file, 'utf8');
    const parsed = JSON.parse(raw);
    cached = validateConfig(parsed);
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
    if (isValidId(cfg.mainGuildId)) return cfg.mainGuildId;
    const support = (cfg as any).support?.guildId;
    if (isValidId(support)) return support;
    if (cfg.banca?.supportGuildId && isValidId(cfg.banca.supportGuildId)) return cfg.banca.supportGuildId;
    const area = cfg.areas.find(a=>isValidId(a.guildId));
    return area?.guildId;
}
