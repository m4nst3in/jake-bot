import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, PermissionsBitField, GuildMember } from 'discord.js';
import { BlacklistRepository } from '../repositories/blacklistRepository.ts';
import { loadConfig } from '../config/index.ts';
export interface RecruitAreaMeta {
    key: string;
    label: string;
}
function buildAreas(): RecruitAreaMeta[] {
    const cfg = loadConfig();
    return cfg.areas
        .filter(a => ['MOVCALL', 'DESIGN', 'RECRUTAMENTO', 'JORNALISMO', 'EVENTOS'].includes(a.name.toUpperCase()))
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
        .addUserOption(o => o.setName('usuario').setDescription('Usuário a ser recrutado').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const member = interaction.member as GuildMember | null;
        const cfg: any = loadConfig();
        const allowedRoleIds: string[] = cfg?.permissions?.recruit?.allowedRoles || [];
    const owners: string[] = Array.isArray(cfg.owners) ? cfg.owners : [];
    const isOwner = member ? owners.includes(member.id) : false;
    const hasAllowedRole = !!member?.roles?.cache?.some(r => allowedRoleIds.includes(r.id));
    const fullAccessRoleId: string | undefined = cfg.fullAccessRoleId;
    const hasFull = !!(fullAccessRoleId && member?.roles?.cache?.has(fullAccessRoleId));
    if (!isOwner && !hasAllowedRole && !hasFull) {
            await interaction.editReply('Sem permissão para usar este comando.');
            return;
        }
        const target = interaction.options.getUser('usuario', true);
        const blRepo = new BlacklistRepository();
        let active: any[] = [];
        try {
            active = await (blRepo as any).listUserActive(target.id);
        }
        catch { }
        const isGlobal = active.some(a => a.area_or_global?.toUpperCase() === 'GLOBAL');
        const byArea = new Set(active.filter(a => a.area_or_global && a.area_or_global.toUpperCase() !== 'GLOBAL').map(a => a.area_or_global.toUpperCase()));
        const globalReasons = active
            .filter(a => a.area_or_global?.toUpperCase() === 'GLOBAL')
            .map(a => `• ${a.reason || 'Sem motivo'}`)
            .join('\n') || '—';
        const embed = new EmbedBuilder()
            .setTitle('<a:c_estrelar:1385143839743934496> Recrutamento de Usuário')
            .setColor(isGlobal ? 0xe74c3c : 0x3498db)
            .setDescription([
            `Selecione a equipe para recrutar **${target.tag}**.`,
            isGlobal ? '\n⚠️ O usuário está na **Blacklist GLOBAL**. Todas as equipes estão bloqueadas.' : `\nÁreas indisponíveis (blacklist por área): ${byArea.size ? [...byArea].join(', ') : 'Nenhuma'}`
        ].join('\n'))
            .setFooter({ text: isGlobal ? 'Remova da blacklist global para liberar o recrutamento.' : 'Clique em apenas uma equipe' });
        if (isGlobal) {
            embed.addFields({ name: 'Motivos (GLOBAL)', value: globalReasons });
        }
        const rows: ActionRowBuilder<ButtonBuilder>[] = [];
        let current = new ActionRowBuilder<ButtonBuilder>();
        for (const area of RECRUIT_AREAS) {
            if (current.components.length === 5) {
                rows.push(current);
                current = new ActionRowBuilder<ButtonBuilder>();
            }
            const disabled = isGlobal || byArea.has(area.label.toUpperCase());
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
