import { Interaction } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { client } from '../index.ts';
export default async function interactionCreate(interaction: Interaction) {
    try {
        if (interaction.isChatInputCommand()) {
            const cmd = client.commands.get(interaction.commandName);
            if (!cmd)
                return;
            await cmd.execute(interaction);
        }
        else if (interaction.isButton()) {
            let handler: any = client.buttons.get(interaction.customId);
            if (!handler) {
                for (const [k, h] of client.buttons.entries() as any) {
                    if (k && typeof k === 'object' && 'test' in k && typeof k.test === 'function') {
                        try { if (k.test(interaction.customId)) { handler = h; break; } } catch {}
                    }
                }
            }
            if (!handler && interaction.customId.includes(':')) {
                const base = interaction.customId.split(':')[0];
                handler = client.buttons.get(base);
            }
            if (handler) await handler.execute(interaction);
        }
        else if (interaction.isStringSelectMenu()) {
            let handler: any = client.selects.get(interaction.customId);
            if (!handler) {
                for (const [k, h] of client.selects.entries() as any) {
                    if (k && typeof k === 'object' && 'test' in k && typeof k.test === 'function') {
                        try { if (k.test(interaction.customId)) { handler = h; break; } } catch {}
                    }
                }
            }
            if (!handler && interaction.customId.includes(':')) {
                const base = interaction.customId.split(':')[0];
                handler = client.selects.get(base);
            }
            if (handler) await handler.execute(interaction);
        }
        else if (interaction.isModalSubmit()) {
            let handler: any = client.modals.get(interaction.customId);
            if (!handler) {
                for (const [k, h] of client.modals.entries() as any) {
                    if (k && typeof k === 'object' && 'test' in k && typeof k.test === 'function') {
                        try { if (k.test(interaction.customId)) { handler = h; break; } } catch {}
                    }
                }
            }
            if (!handler && interaction.customId.includes(':')) {
                const base = interaction.customId.split(':')[0];
                handler = client.modals.get(base);
            }
            if (handler) await handler.execute(interaction);
        }
    }
    catch (err) {
        logger.error({ err }, 'Erro processando interação');
        if (interaction.isRepliable()) {
            await interaction.reply({ content: 'Ocorreu um erro inesperado. Tente novamente.', ephemeral: true }).catch(() => { });
        }
    }
}
