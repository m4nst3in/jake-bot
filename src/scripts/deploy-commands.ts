import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
async function main() {
    if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_CLIENT_ID)
        throw new Error('Missing env vars');
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const commandsDir = path.join(process.cwd(), 'src', 'commands');
    const purge = process.argv.includes('--purge');
    if (purge) {
        try {
            const existing: any = await rest.get(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID));
            if (Array.isArray(existing) && existing.length) {
                for (const cmd of existing) {
                    await rest.delete(Routes.applicationCommand(process.env.DISCORD_CLIENT_ID!, cmd.id));
                    console.log(`Removido comando antigo: ${cmd.name}`);
                }
                console.log(`Total removidos: ${existing.length}`);
            }
            else {
                console.log('Nenhum comando antigo para remover.');
            }
        }
        catch (e) {
            console.warn('Falha ao purgar comandos antigos:', e);
        }
    }
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');
    const body: any[] = [];
    for (const file of files) {
        const mod = await import(path.join(commandsDir, file));
        if (mod.default?.data)
            body.push(mod.default.data.toJSON());
    }
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body });
    console.log(`Registrados ${body.length} comandos (purge=${purge}).`);
}
main().catch(err => { console.error(err); process.exit(1); });
