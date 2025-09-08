import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, PermissionsBitField } from 'discord.js';
import { BlacklistRepository } from '../repositories/blacklistRepository.ts';
import { loadConfig } from '../config/index.ts';
export interface RecruitAreaMeta {
    key: string;
    label: string;
}
function buildAreas(): RecruitAreaMeta[] {
    const cfg = loadConfig();
    return cfg.areas
        .filter(a => ['MOVCALL', 'DESIGN', 'RECRUTAMENTO', 'JORNALISMO', 'SUPORTE', 'EVENTOS'].includes(a.name.toUpperCase()))
        .map(a => ({
        key: a.name.toLowerCase(),
        label: a.name.toUpperCase() === 'MOVCALL' ? 'Mov Call' : a.name.charAt(0) + a.name.slice(1).toLowerCase()
    }));
}
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
        const blRepo = new BlacklistRepository();
        let active: any[] = [];
        try {
            active = await (blRepo as any).listUserActive(target.id);
        }
        catch { }
        const isGlobal = active.some(a => a.area_or_global?.toUpperCase() === 'GLOBAL');
        const byArea = new Set(active.filter(a => a.area_or_global && a.area_or_global.toUpperCase() !== 'GLOBAL').map(a => a.area_or_global.toUpperCase()));
        if (isGlobal) {
            const reasons = active.filter(a => a.area_or_global?.toUpperCase() === 'GLOBAL').map(a => `• ${a.reason || 'Sem motivo'}`).join('\n') || '—';
            const blockedEmbed = new EmbedBuilder()
                .setTitle('🚫 Recrutamento Bloqueado')
                .setColor(0xe74c3c)
                .setDescription(`O usuário **${target.tag}** está na **Blacklist GLOBAL** e não pode ser recrutado para nenhuma equipe no momento.`)
                .addFields({ name: 'Motivos', value: reasons })
                .setFooter({ text: 'Remova da blacklist para liberar o recrutamento.' });
            await interaction.editReply({ embeds: [blockedEmbed], components: [] });
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle('🧩 Recrutamento de Usuário')
            .setDescription(`Selecione a equipe para recrutar **${target.tag}**.\n\nÁreas indisponíveis (blacklist): ${byArea.size ? [...byArea].join(', ') : 'Nenhuma'}`)
            .setColor(0x3498db)
            .setFooter({ text: 'Clique em apenas uma equipe' });
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        let current = new ActionRowBuilder<ButtonBuilder>();
        for (const area of RECRUIT_AREAS) {
            if (current.components.length === 5) {
                rows.push(current);
                current = new ActionRowBuilder<ButtonBuilder>();
            }
            const disabled = byArea.has(area.label.toUpperCase());
            current.addComponents(new ButtonBuilder()
                .setCustomId(`recruit_team:${area.key}:${target.id}`)
                .setLabel(area.label)
                .setStyle(1)
                .setDisabled(disabled));
        }
        if (current.components.length)
            rows.push(current);
        await interaction.editReply({ embeds: [embed], components: rows });
    }
};
