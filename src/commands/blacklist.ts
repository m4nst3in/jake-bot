import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { loadConfig } from '../config/index.ts';

function isAdmin(i:ChatInputCommandInteraction){ return i.memberPermissions?.has(PermissionsBitField.Flags.Administrator) || false; }
function isLeader(i:ChatInputCommandInteraction){
    if(!i.guild) return false;
    const cfg:any = loadConfig();
    const area = cfg.areas?.find((a:any)=>a.guildId === i.guild!.id);
    const leaderRole = area?.roleIds?.lead;
    if(!leaderRole) return false;
    const m:any = i.member; return !!m?.roles?.cache?.has(leaderRole);
}
export default {
    data: new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Painel de blacklist para um staff')
    .addUserOption(o => o.setName('staff').setDescription('Staff alvo').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    if(!isAdmin(interaction) && !isLeader(interaction)) { return interaction.editReply('Apenas liderança ou administradores.'); }
        const target = interaction.options.getUser('staff', true);
        const embed = new EmbedBuilder()
            .setTitle('🚫 Painel de Blacklist')
            .setDescription(`Gerencie ou liste as blacklists de **${target.tag}**.`)
            .addFields({ name: '👤 Usuário', value: `<@${target.id}>`, inline: true }, { name: '🆔 ID', value: target.id, inline: true })
            .setColor(0xe74c3c)
            .setFooter({ text: 'Escolha uma opção abaixo' });
        if (target.avatarURL())
            embed.setThumbnail(target.avatarURL()!);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`bl_manage:${target.id}`).setLabel('Gerenciar').setStyle(1).setEmoji('🛠️'), new ButtonBuilder().setCustomId(`bl_list:${target.id}`).setLabel('Listar').setStyle(2).setEmoji('📋'));
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};
