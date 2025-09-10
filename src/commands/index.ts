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
    const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') && f !== 'index.ts');
    for (const file of files) {
        if (file === 'config.ts') {
            continue;
        }
        const mod = await import(pathToFileURL(path.join(commandsPath, file)).href);
        const cmd: SlashCommand = mod.default;
        if (!cmd?.data)
            continue;
        client.commands.set(cmd.data.name, cmd);
        commands.push(cmd.data.toJSON());
    }
    logger.info({ count: commands.length }, 'Comandos carregados igual o Fumaça no CS');
    if (process.env.DISCORD_TOKEN && process.env.DISCORD_CLIENT_ID) {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        const appId = process.env.DISCORD_CLIENT_ID;
        const guilds = (process.env.DEPLOY_GUILDS || '').split(',').map(s => s.trim()).filter(Boolean);
        try {
            if (guilds.length) {
                for (const g of guilds) {
                    await rest.put(Routes.applicationGuildCommands(appId, g), { body: commands });
                    logger.info({ guild: g, count: commands.length }, 'Slash commands (guild) registrados');
                }
            }
            if (!guilds.length || process.env.GLOBAL === 'true') {
                await rest.put(Routes.applicationCommands(appId), { body: commands });
                logger.info({ count: commands.length }, 'Slash commands (global) registrados');
            }
        }
        catch (err) {
            logger.error({ err }, 'Falha ao registrar comandos');
        }
    }
}
