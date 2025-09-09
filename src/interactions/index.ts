import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client } from 'discord.js';
import { logger } from '../utils/logger.ts';
export async function loadInteractions(client: Client) {
    const base = path.join(process.cwd(), 'src', 'interactions');
    const folders = ['buttons', 'modals', 'selects'];
    for (const folder of folders) {
        const folderPath = path.join(base, folder);
        if (!fs.existsSync(folderPath))
            continue;
        const entries = fs.readdirSync(folderPath, { withFileTypes: true });
        const files: string[] = [];
        for (const ent of entries) {
            if (!ent.isFile())
                continue;
            const name = ent.name;
            if (!name.endsWith('.ts'))
                continue;
            if (!/^[-a-zA-Z0-9_.]+$/.test(name)) {
                logger.warn({ file: name }, 'Ignorando interação com nome inválido');
                continue;
            }
            files.push(name);
        }
        for (const file of files) {
            const full = path.join(folderPath, file);
            let real: string;
            try {
                real = fs.realpathSync(full);
            }
            catch {
                real = full;
            }
            try {
                const mod = await import(pathToFileURL(real).href);
                const handler = mod.default;
                if (!handler?.id)
                    continue;
                if (folder === 'buttons')
                    client.buttons.set(handler.id, handler);
                if (folder === 'modals')
                    client.modals.set(handler.id, handler);
                if (folder === 'selects')
                    client.selects.set(handler.id, handler);
            }
            catch (err) {
                logger.error({ err, file, folder }, 'Falha ao importar interação');
            }
        }
    }
    logger.info('Carreguei as interações, pdc?');
}
