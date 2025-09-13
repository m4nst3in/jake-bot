import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { PointsService } from '../../services/pointsService.ts';
import { loadConfig } from '../../config/index.ts';
import { logger } from '../../utils/logger.ts';
const scfg: any = (loadConfig() as any).support || {};
const PLANTAO_CHANNEL = scfg.channels?.plantao;
const SUPERVISAO_CHANNEL = scfg.channels?.plantaoSupervisao;
const LOG_CHANNEL = scfg.channels?.plantaoLog;
const pointsService = new PointsService();
export default {
    id: 'plantao_accept',
    async execute(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const parts = interaction.customId.split(':');
        const messageId = parts[1];
        const userId = parts[2];
        const staffId = interaction.user.id;
        let plantaoUserIds: string[] = [];
        try {
            const channel: any = PLANTAO_CHANNEL ? await interaction.client.channels.fetch(PLANTAO_CHANNEL).catch(() => null) : null;
            if (channel && channel.isTextBased()) {
                const original = await channel.messages.fetch(messageId).catch(() => null);
                if (original) {
                    const mentions = original.mentions.users;
                    if (mentions && mentions.size > 0) {
                        const mentionedIds = Array.from(mentions.keys())
                            .filter(id => id !== userId)
                            .slice(0, 2);
                        plantaoUserIds = mentionedIds as string[];
                    }
                    await original.delete().catch(() => { });
                }
            }
        }
        catch { }
        const pointsPerUser = 20;
        const successfulPoints: string[] = [];
        const failedPoints: string[] = [];
        for (const targetUserId of plantaoUserIds) {
            try {
                await pointsService.registrarPlantao(targetUserId, 'Suporte', pointsPerUser, staffId);
                successfulPoints.push(targetUserId);
            }
            catch {
                failedPoints.push(targetUserId);
            }
        }
        if (!PLANTAO_CHANNEL || !LOG_CHANNEL) {
            logger.warn({ PLANTAO_CHANNEL, LOG_CHANNEL }, 'Config de plantão incompleta no bot');
        }
        try {
            await interaction.message.delete().catch(() => { });
        }
        catch { }
        try {
            const logCh: any = LOG_CHANNEL ? await interaction.client.channels.fetch(LOG_CHANNEL).catch(() => null) : null;
            if (logCh && logCh.isTextBased()) {
                const usersList = successfulPoints.length > 0 ? successfulPoints.map(id => `<@${id}>`).join(', ') : 'Nenhum usuário mencionado';
                const totalPoints = successfulPoints.length * pointsPerUser;
                const embed = new EmbedBuilder()
                    .setTitle('✅ Plantão Aceito')
                    .setColor(0x2ecc71)
                    .setDescription(`**Usuário(s) mencionado(s):** ${usersList}\n**Staff:** <@${staffId}>\n**Pontos concedidos:** **${totalPoints}** (${pointsPerUser} por pessoa)${failedPoints.length ? `\n**⚠️ Falha:** ${failedPoints.map(id => `\`${id}\``).join(', ')}` : ''}`)
                    .setTimestamp();
                await logCh.send({ embeds: [embed] });
            }
        }
        catch { }
        const resultMessage = successfulPoints.length > 0
            ? `Plantão aceito. Pontos adicionados para ${successfulPoints.length} usuário(s) mencionado(s).`
            : 'Plantão aceito. Nenhum usuário mencionado encontrado.';
        await interaction.editReply({ content: resultMessage });
    }
};
