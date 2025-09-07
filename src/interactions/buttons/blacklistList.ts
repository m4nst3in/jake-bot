import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { BlacklistService } from '../../services/blacklistService.ts';
const svc = new BlacklistService();
export default {
    id: 'bl_list',
    async execute(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const targetId = interaction.customId.split(':')[1];
        const records = await (svc as any).listUser(targetId);
        if (!records.length) {
            await interaction.editReply({ content: '✅ Este usuário não possui blacklists ativas.' });
            return;
        }
        const grouped: Record<string, any[]> = {};
        for (const r of records) {
            (grouped[r.area_or_global] = grouped[r.area_or_global] || []).push(r);
        }
        const embed = new EmbedBuilder()
            .setTitle('📋 Blacklists Ativas')
            .setDescription(`Usuário: <@${targetId}> (${targetId})`)
            .setColor(0xe74c3c);
        for (const area of Object.keys(grouped)) {
            const reasons = grouped[area].map(g => `• ${g.reason}`).join('\n');
            embed.addFields({ name: area, value: reasons.slice(0, 1000) });
        }
        await interaction.editReply({ embeds: [embed] });
    }
};
