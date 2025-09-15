import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { hasCrossGuildLeadership } from '@utils/permissions.ts';
function isAdmin(i: ChatInputCommandInteraction) { return i.memberPermissions?.has(PermissionsBitField.Flags.Administrator) || false; }
async function isLeader(i: ChatInputCommandInteraction) {
    if (!i.guild)
        return false;
    const cfg: any = loadConfig();
    const area = cfg.areas?.find((a: any) => a.guildId === i.guild!.id);
    const leaderRole = area?.roleIds?.lead;
    const m: any = i.member;
    if (leaderRole && m?.roles?.cache?.has(leaderRole))
        return true;
    return await hasCrossGuildLeadership(i.client, m?.id);
}
export default {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Painel de blacklist para um staff')
        .addUserOption(o => o.setName('staff').setDescription('Staff alvo').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const hasTimeout = interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers);
        if (!isAdmin(interaction) && !(await isLeader(interaction)) && !hasTimeout) {
            return interaction.editReply('Apenas liderança ou administradores.');
        }
        const target = interaction.options.getUser('staff', true);
        const embed = new EmbedBuilder()
            .setTitle('<a:mov_call9:1193567633455456267> Painel de Blacklist')
            .setDescription(`Gerencie ou liste as blacklists de **${target.tag}**.`)
            .addFields({ name: '<:emoji_44:1313615518573265077> Usuário', value: `<@${target.id}>`, inline: true }, { name: '<a:crown_white:1312241140615090216> ID', value: target.id, inline: true })
            .setColor(0xe74c3c)
            .setFooter({ text: 'Escolha uma opção abaixo', iconURL: interaction.guild?.iconURL() || undefined });
        if (target.avatarURL())
            embed.setThumbnail(target.avatarURL()!);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`bl_manage:${target.id}`).setLabel('Gerenciar').setStyle(1).setEmoji('<:mov_call19:1195026598454362152>'), new ButtonBuilder().setCustomId(`bl_list:${target.id}`).setLabel('Listar').setStyle(2).setEmoji('<:mov_call20:1193710198615977985>'));
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};
