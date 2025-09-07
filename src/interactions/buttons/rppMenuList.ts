import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { rppStatusLabel } from '../../utils/statusLabels.ts';
import { RPPService } from '../../services/rppService.ts';
const service = new RPPService();
export default {
    id: 'rpp_menu_list',
    async execute(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const parts = interaction.customId.split(':');
        const page = parts[1] ? Math.max(1, parseInt(parts[1])) : 1;
        const pageSize = 10;
        const { items, total, pages } = await service.listActivePaged(page, pageSize);
        if (!items.length) {
            await interaction.editReply('Nenhum usuário em RPP ativo.');
            return;
        }
        const start = (page - 1) * pageSize;
        const lines = items.map((p, i) => `**${start + i + 1}.** <@${p.user_id}> — ${rppStatusLabel(p.status)}${p.reason ? ` | Motivo: ${p.reason}` : ''}${p.return_date ? ` | Retorno: ${p.return_date}` : ''}`);
        const embed = new EmbedBuilder()
            .setTitle(`📋 RPPs Ativos`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Página ${page}/${pages} • Total: ${total}` })
            .setColor(0x4b9cd3)
            .setTimestamp();
        const prev = new ButtonBuilder().setCustomId(`rpp_menu_list:${page - 1}`).setLabel('←').setStyle(2).setDisabled(page <= 1);
        const next = new ButtonBuilder().setCustomId(`rpp_menu_list:${page + 1}`).setLabel('→').setStyle(2).setDisabled(page >= pages);
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prev, next);
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};
