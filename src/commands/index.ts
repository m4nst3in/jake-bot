import { Client, REST, Collection } from 'discord.js';
import { Routes } from 'discord-api-types/v10';
import { logger } from '../utils/logger.ts';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
export interface SlashCommand {
    data: any;
    execute: (interaction: any) => Promise<any>;
    guildOnly?: boolean;
    permissions?: string[];
}
export async function loadCommands(client: Client) {
    const commands: any[] = [];
    const commandsPath = path.join(process.cwd(), 'src', 'commands');
    const rawFiles = fs.readdirSync(commandsPath, { withFileTypes: true });
    const files: string[] = [];
    for (const dirent of rawFiles) {
        if (!dirent.isFile())
            continue;
        const name = dirent.name;
        if (!name.endsWith('.ts'))
            continue;
        if (name === 'index.ts' || name === 'config.ts')
            continue;
        if (!/^[-a-zA-Z0-9_.]+$/.test(name)) {
            logger.warn({ file: name }, 'Ignorando arquivo de comando com nome inválido');
            continue;
        }
        files.push(name);
    }
    for (const file of files) {
        const full = path.join(commandsPath, file);
        let real: string;
        try {
            real = fs.realpathSync(full);
        }
        catch {
            real = full;
        }
        try {
            const mod = await import(pathToFileURL(real).href);
            const cmd: SlashCommand = mod.default;
            if (!cmd?.data)
                continue;
            client.commands.set(cmd.data.name, cmd);
            commands.push(cmd.data.toJSON());
        }
        catch (err) {
            logger.error({ err, file }, 'Falha ao importar comando');
        }
    }
    logger.info({ count: commands.length }, 'Comandos carregados igual o Fumaça no CS');
    if (process.env.DISCORD_TOKEN && process.env.DISCORD_CLIENT_ID) {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
            logger.info('Comandos de barra registrados parça');
        }
        catch (err) {
            logger.error({ err }, 'Falha ao registrar comandos');
        }
    }
}
