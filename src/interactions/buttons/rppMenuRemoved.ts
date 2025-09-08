import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, GuildMember } from 'discord.js';
import { rppStatusLabel } from '../../utils/statusLabels.ts';
import { RPPService } from '../../services/rppService.ts';
import { isOwner } from '../../utils/permissions.ts';
const service = new RPPService();
export default {
    id: 'rpp_menu_removed',
    async execute(interaction: ButtonInteraction) {
    const member = interaction.member as GuildMember | null;
    if (!isOwner(member) && !interaction.memberPermissions?.has('ManageGuild')) {
            await interaction.reply({ content: 'Sem permissão.', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        const parts = interaction.customId.split(':');
        const page = parts[1] ? Math.max(1, parseInt(parts[1])) : 1;
        const pageSize = 10;
        const { items, total, pages } = await service.listRemovedPaged(page, pageSize);
        if (!items.length) {
            await interaction.editReply('Nenhum RPP removido.');
            return;
        }
        const start = (page - 1) * pageSize;
        const lines = items.map((p, i) => `**${start + i + 1}.** <@${p.user_id}> — ${rppStatusLabel('REMOVED')}${p.reason ? ` | Motivo: ${p.reason}` : ''}${p.return_date ? ` | Retorno: ${p.return_date}` : ''}`);
        const embed = new EmbedBuilder()
            .setTitle('📋 RPPs Encerrados')
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Página ${page}/${pages} • Total: ${total}` })
            .setColor(0x95a5a6)
            .setTimestamp();
        const prev = new ButtonBuilder().setCustomId(`rpp_menu_removed:${page - 1}`).setLabel('←').setStyle(2).setDisabled(page <= 1);
        const next = new ButtonBuilder().setCustomId(`rpp_menu_removed:${page + 1}`).setLabel('→').setStyle(2).setDisabled(page >= pages);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next);
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};
