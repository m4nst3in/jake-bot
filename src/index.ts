import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { logger } from './utils/logger.ts';
import { registerEventHandlers } from './events/index.ts';
import { loadCommands } from './commands/index.ts';
import { loadInteractions } from './interactions/index.ts';
import { DatabaseManager } from './db/manager.ts';
export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.GuildMember, Partials.Channel, Partials.Message]
});
(globalThis as any).client = client;
client.commands = new Collection();
client.buttons = new Collection();
client.modals = new Collection();
client.selects = new Collection();
async function bootstrap() {
    logger.info('Inicializando bot Jake da CDW...');
    await DatabaseManager.init();
    await loadCommands(client);
    await loadInteractions(client);
    registerEventHandlers(client);
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('Bot Jakezaum logado.');
}
bootstrap().catch(err => {
    logger.error({ err }, 'Erro fatal no bootstrap do bot');
    process.exit(1);
});
