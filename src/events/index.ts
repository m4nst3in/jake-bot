import { Client, Events } from 'discord.js';
import { logger } from '../utils/logger.ts';
import ready from './ready.ts';
import interactionCreate from './interactionCreate.ts';
import messageCreate from './messageCreate.ts';
import { registerProtectionListener } from './guildMemberUpdate.ts';
export function registerEventHandlers(client: Client) {
    client.once(Events.ClientReady, ready);
    client.on(Events.InteractionCreate, interactionCreate);
    client.on(Events.MessageCreate, messageCreate);
    registerProtectionListener(client);
    logger.info('Registrei os handlers de eventos, pdc?');
}
