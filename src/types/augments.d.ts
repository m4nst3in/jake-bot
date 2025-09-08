import { Collection } from 'discord.js';
import type { SlashCommand } from '../commands/index.ts';
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, SlashCommand>;
        buttons: Collection<string, any>;
        modals: Collection<string, any>;
        selects: Collection<string, any>;
    }
}
