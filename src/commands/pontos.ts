import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, GuildMember } from 'discord.js';
import { hasAnyLeadership, isAdminFromMember, isOwner, hasCrossGuildLeadership, getMemberExtraManagedAreas } from '@utils/permissions.ts';
import { loadConfig } from '../config/index.ts';
export default {
    data: new SlashCommandBuilder().setName('pontos').setDescription('Painel de gestão de pontos'),
    async execute(interaction: ChatInputCommandInteraction) {
        const member = interaction.member as GuildMember | null;
        const isAdm = isAdminFromMember(member || null);
        let hasLeadership = hasAnyLeadership(member || null);
        const extraAreas = getMemberExtraManagedAreas(member || null);
        if (!hasLeadership && member) {
            hasLeadership = await hasCrossGuildLeadership(interaction.client, member.id);
        }
        if (!isAdm && !hasLeadership && extraAreas.length === 0) {
            await interaction.reply({ content: 'Apenas liderança, administradores ou donos.', ephemeral: true });
            return;
        }
        const cfg: any = loadConfig();
        const champion = cfg.emojis?.champion || '<a:champion:placeholder>';
        const dot = cfg.emojis?.dot || '•';
        const embed = new EmbedBuilder()
            .setColor((() => {
            if (interaction.guildId === cfg.banca?.supportGuildId)
                return 0xFFFFFF;
            try {
                const movGuild = (cfg.areas || []).find((a: any) => a.name === 'MOVCALL')?.guildId;
                const recruitGuild = (cfg.areas || []).find((a: any) => a.name === 'RECRUTAMENTO')?.guildId;
                if (movGuild && interaction.guildId === movGuild)
                    return 0x8B0000;
                if (recruitGuild && interaction.guildId === recruitGuild)
                    return 0x39ff14;
            }
            catch { }
            return 0x1f2a44;
        })())
            .setTitle(`${champion} Painel de Pontos`)
            .setDescription([
            `${dot} Gerencie pontos rapidamente nas áreas onde você tem liderança${isOwner(member) ? ' (owner: todas as áreas)' : (extraAreas.length ? ' (inclui permissões especiais)' : '')}.`,
            `${dot} Use os botões abaixo para adicionar ou remover; tudo é logado automaticamente.`
        ].join('\n\n'))
            .setFooter({ text: 'Sistema de Pontos', iconURL: interaction.guild?.iconURL() || undefined });
        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
            .setCustomId('pts_action:add')
            .setLabel('Adicionar Pontos')
            .setStyle(3), new ButtonBuilder()
            .setCustomId('pts_action:remove')
            .setLabel('Remover Pontos')
            .setStyle(4));
        await interaction.reply({ embeds: [embed], components: [row1], ephemeral: true });
    }
};
