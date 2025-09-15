import { EmbedBuilder, ColorResolvable } from 'discord.js';
export interface BaseEmbedOptions {
    title?: string;
    description?: string;
    color?: ColorResolvable;
    footer?: string;
    iconURL?: string;
    fields?: {
        name: string;
        value: string;
        inline?: boolean;
    }[];
}
export function baseEmbed(opts: BaseEmbedOptions) {
    const e = new EmbedBuilder();
    if (opts.title)
        e.setTitle(opts.title);
    if (opts.description)
        e.setDescription(opts.description);
    if (opts.color)
        e.setColor(opts.color);
    if (opts.fields)
        e.addFields(opts.fields);
    e.setTimestamp();
    if (opts.footer)
        e.setFooter({ text: opts.footer, iconURL: opts.iconURL });
    return e;
}
