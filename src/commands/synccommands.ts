import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, REST } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Routes } from 'discord-api-types/v10';
import { isOwner, isAdminFromMember } from '../utils/permissions.ts';
import { logger } from '../utils/logger.ts';

/*
 * /synccommands
 * Recarrega dinamicamente os arquivos de comandos e re-registra (guild e opcionalmente global) sem reiniciar o bot.
 * Opção --global (boolean) força também o deploy global independente de GLOBAL env.
 */

export default {
  data: new SlashCommandBuilder()
    .setName('synccommands')
    .setDescription('Sincroniza (re-registra) os slash commands do bot')
    .addBooleanOption(o => o.setName('global').setDescription('Também registrar global (propagação lenta)').setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const member = interaction.member as GuildMember | null;
    if (!isOwner(member) && !isAdminFromMember(member)) {
      await interaction.editReply('Sem permissão.');
      return;
    }

    const token = process.env.DISCORD_TOKEN;
    const appId = process.env.DISCORD_CLIENT_ID;
    if (!token || !appId) {
      await interaction.editReply('Variáveis DISCORD_TOKEN ou DISCORD_CLIENT_ID ausentes.');
      return;
    }

    const doGlobal = interaction.options.getBoolean('global') === true || process.env.GLOBAL === 'true';
    const guilds = (process.env.DEPLOY_GUILDS || '').split(',').map(s => s.trim()).filter(Boolean);

    // Carregar comandos novamente (cache bust) e atualizar client.commands
    const commandsDir = path.join(process.cwd(), 'src', 'commands');
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'config.ts');
    const body: any[] = [];
    for (const file of files) {
      try {
        const full = path.join(commandsDir, file);
        const mod: any = await import(pathToFileURL(full + '?' + Date.now()).href);
        const cmd = mod.default || mod;
        if (!cmd?.data) continue;
        interaction.client.commands.set(cmd.data.name, cmd);
        if (typeof cmd.data.toJSON === 'function') {
          body.push(cmd.data.toJSON());
        }
      } catch (e) {
        logger.error({ file, e }, 'Falha ao recarregar comando');
      }
    }

    const rest = new REST({ version: '10' }).setToken(token);
    let guildResults: string[] = [];
    for (const g of guilds) {
      try {
        await rest.put(Routes.applicationGuildCommands(appId, g), { body });
        guildResults.push(`${g}:OK`);
      } catch (e) {
        guildResults.push(`${g}:ERRO`);
        logger.error({ guild: g, e }, 'Falha ao registrar guild');
      }
    }

    let globalResult = 'IGNORADO';
    if (doGlobal) {
      try {
        await rest.put(Routes.applicationCommands(appId), { body });
        globalResult = 'OK';
      } catch (e) {
        globalResult = 'ERRO';
        logger.error({ e }, 'Falha ao registrar global');
      }
    }

    await interaction.editReply(`Sync concluído. Comandos: ${body.length}\nGuilds: ${guildResults.join(', ') || 'Nenhuma'}\nGlobal: ${globalResult}`);
  }
};
