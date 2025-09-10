import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder, RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';

/*
 * Script de deploy de slash commands.
 * - Por padrão registra em guilds para propagação instantânea.
 * - Se set GLOBAL=true registra global (demora cache ~1h) além de guild.
 * Variáveis necessárias:
 *   DISCORD_TOKEN
 *   DISCORD_CLIENT_ID  (application id)
 *   DEPLOY_GUILDS=lista separada por vírgula de guild IDs (ex: 111,222)
 */

async function loadCommands(): Promise<RESTPostAPIApplicationCommandsJSONBody[]> {
  const commandsDir = path.join(process.cwd(), 'src', 'commands');
  const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.ts'));
  const out: RESTPostAPIApplicationCommandsJSONBody[] = [];
  for (const file of files) {
    const full = path.join(commandsDir, file);
    try {
      const mod = await import(full + '?' + Date.now()); // cache bust
      const cmd = mod.default || mod;
      if (!cmd?.data) continue;
      if (cmd.data instanceof SlashCommandBuilder) {
        out.push(cmd.data.toJSON());
      } else if (typeof cmd.data?.toJSON === 'function') {
        out.push(cmd.data.toJSON());
      }
    } catch (e) {
      console.error('Falha ao carregar comando', file, e);
    }
  }
  return out;
}

async function main() {
  const token = process.env.DISCORD_TOKEN;
  const appId = process.env.DISCORD_CLIENT_ID;
  if (!token || !appId) {
    console.error('DISCORD_TOKEN ou DISCORD_CLIENT_ID ausentes.');
    process.exit(1);
  }
  const deployGuilds = (process.env.DEPLOY_GUILDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!deployGuilds.length) {
    console.warn('Nenhuma guild em DEPLOY_GUILDS; informe para deploy rápido.');
  }
  const rest = new REST({ version: '10' }).setToken(token);
  const commands = await loadCommands();
  console.log(`Total comandos carregados: ${commands.length}`);
  for (const g of deployGuilds) {
    try {
      await rest.put(Routes.applicationGuildCommands(appId, g), { body: commands });
      console.log(`Guild ${g}: OK (${commands.length})`);
    } catch (e) {
      console.error(`Guild ${g}: ERRO`, e);
    }
  }
  if (process.env.GLOBAL === 'true') {
    try {
      await rest.put(Routes.applicationCommands(appId), { body: commands });
      console.log('Global: OK');
    } catch (e) {
      console.error('Global: ERRO', e);
    }
  }
  console.log('Concluído.');
}

main().catch(e => { console.error(e); process.exit(1); });
