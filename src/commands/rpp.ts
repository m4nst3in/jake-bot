import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, GuildMember, PermissionsBitField } from 'discord.js';
import { RPPService } from '../services/rppService.ts';
import { isOwner, hasAnyLeadership } from '@utils/permissions.ts';
import { loadConfig } from '../config/index.ts';
const service = new RPPService();
export default {
    data: new SlashCommandBuilder()
        .setName('rpp')
        .setDescription('Painel de RPP (use os botões)'),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const member = interaction.member as GuildMember | null;
        const cfg: any = loadConfig();
        const owner = isOwner(member);
        const leadershipRoleId: string | undefined = cfg?.protection?.alertRole;
        const rppAllowed: string[] = cfg?.permissions?.rpp?.allowedRoles || [];
        const isLeaderGeneral = !!member?.roles.cache.has(leadershipRoleId);
        const isAnyAreaLeader = hasAnyLeadership(member);
        const hasConfiguredRole = !!member?.roles.cache.some(r => rppAllowed.includes(r.id));
        if (!owner && !isLeaderGeneral && !isAnyAreaLeader && !hasConfiguredRole) {
            await interaction.editReply('Sem permissão para usar este comando.');
            return;
        }
        const hasTimeout = interaction.memberPermissions?.has(PermissionsBitField.Flags.ModerateMembers);
        const canManage = owner || isLeaderGeneral;
        const { total: activeTotal } = await service.listActivePaged(1, 1);
        let removedTotal: number | undefined;
        if (canManage) {
            const removed = await service.listRemovedPaged(1, 1);
            removedTotal = removed.total;
        }
        const manageBtn = new ButtonBuilder().setCustomId('rpp_menu_manage').setLabel('🛠️ Gerenciar').setStyle(1).setDisabled(!canManage);
        const listBtn = new ButtonBuilder().setCustomId('rpp_menu_list').setLabel('🟢 Ativos').setStyle(3);
        const removedBtn = new ButtonBuilder().setCustomId('rpp_menu_removed').setLabel('📕 Encerrados').setStyle(4).setDisabled(!canManage);
        const embedCfg = cfg.rpp?.guilds?.[interaction.guild!.id]?.embed;
        const tool = embedCfg?.tool || '';
        const dot = embedCfg?.bullet || '•';
        const descParts: string[] = [];
        descParts.push(`${tool} **Painel de RPP**`);
        descParts.push(`${dot} Use os botões abaixo para navegar.`);
        descParts.push(`${dot} 🟢 Ativos: lista de RPPs aceitos.`);
        descParts.push(`${dot} 📕 Encerrados: histórico finalizados.`);
        if (canManage)
            descParts.push(`${dot} 🛠️ Gerenciar: criar / encerrar manualmente.`);
        else if (hasTimeout)
            descParts.push(`${dot} Você vê este painel por possuir permissão de timeout (visualização).`);
        descParts.push(`${dot} Solicitações públicas: use o painel enviado com /embed.`);
        if (canManage)
            descParts.push(`${tool} **Status**\n${dot} Ativos: **${activeTotal}**${removedTotal !== undefined ? `\n${dot} Encerrados: **${removedTotal}**` : ''}`);
        else
            descParts.push(`${tool} **Status**\n${dot} Ativos: **${activeTotal}**`);
        const embed = new EmbedBuilder()
            .setColor(0x101417)
            .setDescription(descParts.join('\n\n'))
            .setFooter({ text: 'RPP • Central da Web' });
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(listBtn, removedBtn, manageBtn);
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};
