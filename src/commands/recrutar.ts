import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, PermissionsBitField } from 'discord.js';
import { loadConfig } from '../config/index.ts';
export interface RecruitAreaMeta { key: string; label: string; }
function buildAreas(): RecruitAreaMeta[] { const cfg = loadConfig(); return cfg.areas.filter(a=>['MOVCALL','DESIGN','RECRUTAMENTO','JORNALISMO','SUPORTE','EVENTOS'].includes(a.name.toUpperCase())).map(a=>({ key: a.name.toLowerCase(), label: a.name.charAt(0)+a.name.slice(1).toLowerCase() })); }
export const RECRUIT_AREAS = buildAreas();
export default {
    data: new SlashCommandBuilder()
        .setName('recrutar')
        .setDescription('Recrutar um usuário para uma equipe')
        .addUserOption(o => o.setName('usuario').setDescription('Usuário a ser recrutado').setRequired(true))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const target = interaction.options.getUser('usuario', true);
    const embed = new EmbedBuilder()
            .setTitle('🧩 Recrutamento de Usuário')
            .setDescription(`Selecione a equipe para recrutar **${target.tag}**.`)
            .setColor(0x3498db)
            .setFooter({ text: 'Clique em apenas uma equipe' });
    const row = new ActionRowBuilder<ButtonBuilder>();
    for (const area of RECRUIT_AREAS) { row.addComponents(new ButtonBuilder().setCustomId(`recruit_team:${area.key}:${target.id}`).setLabel(area.label).setStyle(1)); }
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};
