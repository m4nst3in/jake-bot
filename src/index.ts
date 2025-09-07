import 'dotenv/config';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { logger } from './utils/logger.js';
import { registerEventHandlers } from './events/index.js';
import { loadCommands } from './commands/index.js';
import { loadInteractions } from './interactions/index.js';
import { DatabaseManager } from './db/manager.js';
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
    logger.info('Inicializando bot Jake...');
    await DatabaseManager.init();
    await loadCommands(client);
    await loadInteractions(client);
    registerEventHandlers(client);
    await client.login(process.env.DISCORD_TOKEN);
    logger.info('Bot Jake logado.');
}
bootstrap().catch(err => {
    logger.error({ err }, 'Erro fatal no bootstrap');
    process.exit(1);
});
