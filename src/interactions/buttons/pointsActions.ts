import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, EmbedBuilder, GuildMember } from 'discord.js';
import { loadConfig } from '../../config/index.ts';
import { getMemberLeaderAreas, isAdminFromMember, isOwner } from '../../utils/permissions.ts';
function getAllowedAreas(member: GuildMember | null) {
    const cfg: any = loadConfig();
    if (isOwner(member))
        return (cfg.areas || []).map((a: any) => a.name.charAt(0) + a.name.slice(1).toLowerCase());
    const owned = getMemberLeaderAreas(member);
    return owned.map(a => a.charAt(0) + a.slice(1).toLowerCase());
}
export default {
    id: /^pts_action:(add|remove)$/,
    async execute(interaction: ButtonInteraction) {
        const mode = interaction.customId.split(':')[1];
        const member = interaction.member as GuildMember | null;
        const areas = getAllowedAreas(member);
        if (!areas.length) {
            await interaction.reply({ content: 'Você não tem liderança em nenhuma área, tá loucão?', ephemeral: true });
            return;
        }
        const rows: any[] = [];
        const buttons = areas.map((a: string) => new ButtonBuilder().setCustomId(`pts_area:${mode}:${a}`).setLabel(a).setStyle(2));
        for (let i = 0; i < buttons.length; i += 5) {
            rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + 5)));
        }
        const embed = new EmbedBuilder().setTitle(mode === 'add' ? 'Adicionar Pontos' : 'Remover Pontos').setDescription('Selecione a área.').setColor(mode === 'add' ? 0x2ecc71 : 0xe74c3c);
        try {
            await interaction.update({ embeds: [embed], components: rows });
        }
        catch {
            await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
        }
    }
};
