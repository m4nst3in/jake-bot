import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'discord.js';
import { logger } from '../utils/logger.ts';
export async function loadInteractions(client: Client) {
    const base = path.join(process.cwd(), 'src', 'interactions');
    const folders = ['buttons', 'modals', 'selects'];
    for (const folder of folders) {
        const folderPath = path.join(base, folder);
        if (!fs.existsSync(folderPath))
            continue;
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.ts'));
        for (const file of files) {
            const mod = await import(path.join(folderPath, file));
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
    }
    logger.info('Carreguei as interações, pdc?');
}
