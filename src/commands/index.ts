import { Client, REST, Routes, Collection, SlashCommandBuilder } from 'discord.js';
import { logger } from '../utils/logger.ts';
import fs from 'node:fs';
import path from 'node:path';
export interface SlashCommand {
    data: SlashCommandBuilder;
    execute: (interaction: any) => Promise<any>;
    guildOnly?: boolean;
    permissions?: string[];
}
export async function loadCommands(client: Client) {
    const commands: any[] = [];
    const commandsPath = path.join(process.cwd(), 'src', 'commands');
    const files = fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') && f !== 'index.ts');
    for (const file of files) {
        if (file === 'config.ts' || file === 'transferir-cargos.ts') {
            continue;
        }
        const mod = await import(path.join(commandsPath, file));
        const cmd: SlashCommand = mod.default;
        if (!cmd?.data)
            continue;
        client.commands.set(cmd.data.name, cmd);
        commands.push(cmd.data.toJSON());
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
