import { EmbedBuilder, ButtonBuilder, ActionRowBuilder, ButtonStyle, User, Client } from 'discord.js';
import { PunishmentRepository, PunishmentRecord, PunishmentHistoryQuery } from '../repositories/punishmentRepository.ts';
import { loadConfig } from '../config/index.ts';
import { logger } from '../utils/logger.ts';
export class PunishmentHistoryService {
    private repo = new PunishmentRepository();
    async getExecutorHistory(executorId: string, options: PunishmentHistoryQuery = {}) {
        return await this.repo.findByExecutor(executorId, options);
    }
    async getUserHistory(userId: string, options: PunishmentHistoryQuery = {}) {
        return await this.repo.findByUser(userId, options);
    }
    async getExecutorStatistics(executorId: string, guildId?: string) {
        return await this.repo.getStatistics(executorId, guildId);
    }
    async createHistoryEmbed(executorId: string, client: Client, page: number = 1, pageSize: number = 5, guildId?: string): Promise<{
        embed: EmbedBuilder;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    }> {
        try {
            const offset = (page - 1) * pageSize;
            const options: PunishmentHistoryQuery = {
                limit: pageSize,
                offset,
                guildId
            };
            const { punishments, total } = await this.getExecutorHistory(executorId, options);
            const stats = await this.getExecutorStatistics(executorId, guildId);
            let executorUser: User | null = null;
            try {
                executorUser = await client.users.fetch(executorId);
            }
            catch (error) {
                logger.warn({ error, executorId }, 'Não foi possível buscar informações do executor');
            }
            const config = loadConfig() as any;
            const embed = new EmbedBuilder()
                .setTitle(`📋 Histórico de Punições - ${executorUser?.username || 'Usuário Desconhecido'}`)
                .setColor(0xE74C3C)
                .setTimestamp()
                .setFooter({
                text: `Página ${page}/${Math.ceil(total / pageSize)} • Total: ${total} punições`,
                iconURL: executorUser?.displayAvatarURL() || undefined
            });
            const statsText = [
                `📊 **Estatísticas Gerais**`,
                `• Total de punições: **${stats.totalPunishments}**`,
                `• Punições ativas: **${stats.activePunishments}**`,
                `• Últimos 30 dias: **${stats.recentPunishments}**`,
                ``
            ];
            if (Object.keys(stats.punishmentsByType).length > 0) {
                statsText.push(`📈 **Por Tipo de Punição**`);
                Object.entries(stats.punishmentsByType)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .forEach(([type, count]) => {
                    const typeName = this.getPunishmentTypeName(type);
                    statsText.push(`• ${typeName}: **${count}**`);
                });
                statsText.push(``);
            }
            if (punishments.length === 0) {
                embed.setDescription([
                    ...statsText,
                    `❌ **Nenhuma punição encontrada nesta página.**`,
                    ``,
                    `*Use os botões abaixo para navegar entre as páginas.*`
                ].join('\n'));
            }
            else {
                const punishmentsList: string[] = [];
                for (const punishment of punishments) {
                    let targetUser: User | null = null;
                    try {
                        targetUser = await client.users.fetch(punishment.userId);
                    }
                    catch (error) {
                    }
                    const targetName = targetUser?.username || `ID: ${punishment.userId}`;
                    const date = `<t:${Math.floor(punishment.appliedAt.getTime() / 1000)}:R>`;
                    const status = punishment.active ? '🟢 Ativa' : '🔴 Removida';
                    let durationText = 'Permanente';
                    if (punishment.duration && punishment.durationType) {
                        const durationMap = {
                            'minutes': 'min',
                            'hours': 'h',
                            'days': 'd'
                        };
                        durationText = `${punishment.duration}${durationMap[punishment.durationType as keyof typeof durationMap]}`;
                    }
                    const punishmentText = [
                        `**${punishment.punishmentName}** ${status}`,
                        `👤 **Usuário:** ${targetName}`,
                        `📅 **Data:** ${date}`,
                        `⏱️ **Duração:** ${durationText}`,
                        `📝 **Motivo:** ${punishment.reason}`,
                    ];
                    if (punishment.proofUrl) {
                        punishmentText.push(`🔗 **Prova:** [Ver anexo](${punishment.proofUrl})`);
                    }
                    if (!punishment.active && punishment.removedAt) {
                        const removedDate = `<t:${Math.floor(punishment.removedAt.getTime() / 1000)}:R>`;
                        punishmentText.push(`🗑️ **Removida:** ${removedDate}`);
                        if (punishment.removalReason) {
                            punishmentText.push(`📄 **Motivo da remoção:** ${punishment.removalReason}`);
                        }
                    }
                    punishmentsList.push(punishmentText.join('\n'));
                }
                embed.setDescription([
                    ...statsText,
                    `📋 **Histórico de Punições**`,
                    ``,
                    punishmentsList.join('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n')
                ].join('\n'));
            }
            const hasNextPage = (page * pageSize) < total;
            const hasPrevPage = page > 1;
            return { embed, hasNextPage, hasPrevPage };
        }
        catch (error) {
            logger.error({ error, executorId, page }, 'Erro ao criar embed do histórico');
            throw error;
        }
    }
    createNavigationButtons(executorId: string, currentPage: number, hasNextPage: boolean, hasPrevPage: boolean): ActionRowBuilder<ButtonBuilder> {
        const buttons: ButtonBuilder[] = [];
        buttons.push(new ButtonBuilder()
            .setCustomId(`punishment_history:${executorId}:${currentPage - 1}`)
            .setLabel('◀️ Anterior')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasPrevPage));
        buttons.push(new ButtonBuilder()
            .setCustomId(`punishment_history_page:${currentPage}`)
            .setLabel(`Página ${currentPage}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true));
        buttons.push(new ButtonBuilder()
            .setCustomId(`punishment_history:${executorId}:${currentPage + 1}`)
            .setLabel('Próxima ▶️')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!hasNextPage));
        buttons.push(new ButtonBuilder()
            .setCustomId(`punishment_history:${executorId}:${currentPage}:refresh`)
            .setLabel('🔄')
            .setStyle(ButtonStyle.Primary));
        buttons.push(new ButtonBuilder()
            .setCustomId('punishment_history:close')
            .setLabel('❌')
            .setStyle(ButtonStyle.Danger));
        return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    }
    async createSummaryEmbed(executorId: string, client: Client, guildId?: string): Promise<EmbedBuilder> {
        try {
            const stats = await this.getExecutorStatistics(executorId, guildId);
            const recentPunishments = await this.getExecutorHistory(executorId, {
                limit: 3,
                guildId
            });
            let executorUser: User | null = null;
            try {
                executorUser = await client.users.fetch(executorId);
            }
            catch (error) {
                logger.warn({ error, executorId }, 'Não foi possível buscar informações do executor');
            }
            const embed = new EmbedBuilder()
                .setTitle(`📊 Resumo de Punições - ${executorUser?.username || 'Usuário Desconhecido'}`)
                .setColor(0x3498DB)
                .setTimestamp()
                .setThumbnail(executorUser?.displayAvatarURL() || null)
                .setFooter({
                text: 'Sistema de Histórico de Punições - CDW',
                iconURL: executorUser?.displayAvatarURL() || undefined
            });
            const descriptionParts: string[] = [];
            descriptionParts.push(`📊 **Estatísticas Gerais**`);
            descriptionParts.push(`• Total de punições aplicadas: **${stats.totalPunishments}**`);
            descriptionParts.push(`• Punições ainda ativas: **${stats.activePunishments}**`);
            descriptionParts.push(`• Punições nos últimos 30 dias: **${stats.recentPunishments}**`);
            descriptionParts.push(``);
            if (Object.keys(stats.punishmentsByType).length > 0) {
                descriptionParts.push(`📈 **Distribuição por Tipo**`);
                Object.entries(stats.punishmentsByType)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5)
                    .forEach(([type, count]) => {
                    const typeName = this.getPunishmentTypeName(type);
                    const percentage = ((count / stats.totalPunishments) * 100).toFixed(1);
                    descriptionParts.push(`• ${typeName}: **${count}** (${percentage}%)`);
                });
                descriptionParts.push(``);
            }
            if (recentPunishments.punishments.length > 0) {
                descriptionParts.push(`🕒 **Punições Recentes**`);
                for (const punishment of recentPunishments.punishments) {
                    let targetUser: User | null = null;
                    try {
                        targetUser = await client.users.fetch(punishment.userId);
                    }
                    catch (error) {
                    }
                    const targetName = targetUser?.username || `ID: ${punishment.userId}`;
                    const date = `<t:${Math.floor(punishment.appliedAt.getTime() / 1000)}:R>`;
                    const status = punishment.active ? '🟢' : '🔴';
                    descriptionParts.push(`${status} **${punishment.punishmentName}** → ${targetName} ${date}`);
                }
                descriptionParts.push(``);
            }
            descriptionParts.push(`💡 **Dica:** Use o botão "Ver Histórico Completo" para ver todas as punições com detalhes.`);
            embed.setDescription(descriptionParts.join('\n'));
            return embed;
        }
        catch (error) {
            logger.error({ error, executorId }, 'Erro ao criar embed de resumo');
            throw error;
        }
    }
    createSummaryButtons(executorId: string): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder()
            .setCustomId(`punishment_history:${executorId}:1`)
            .setLabel('📋 Ver Histórico Completo')
            .setStyle(ButtonStyle.Primary), new ButtonBuilder()
            .setCustomId(`punishment_stats:${executorId}`)
            .setLabel('📊 Estatísticas Detalhadas')
            .setStyle(ButtonStyle.Secondary), new ButtonBuilder()
            .setCustomId('punishment_history:close')
            .setLabel('❌ Fechar')
            .setStyle(ButtonStyle.Danger));
    }
    private getPunishmentTypeName(type: string): string {
        const typeNames: Record<string, string> = {
            'timeout': '⏰ Timeout',
            'ban': '🔨 Banimento',
            'mute_voice': '🔇 Mute Voz',
            'mute_text': '💬 Mute Chat',
            'role_add': '🏷️ Cargo Punitivo',
            'kick': '👢 Expulsão',
            'warning': '⚠️ Advertência'
        };
        return typeNames[type] || `❓ ${type}`;
    }
    async logPunishment(punishment: {
        userId: string;
        executorId: string;
        punishmentType: string;
        punishmentName: string;
        reason: string;
        duration?: number;
        durationType?: string;
        guildId: string;
        proofUrl?: string;
        expiresAt?: Date;
    }): Promise<string> {
        try {
            return await this.repo.create({
                ...punishment,
                active: true
            });
        }
        catch (error) {
            logger.error({ error, punishment }, 'Erro ao registrar punição no histórico');
            throw error;
        }
    }
    async removePunishment(punishmentId: string, removedBy: string, reason?: string): Promise<void> {
        try {
            await this.repo.updateStatus(punishmentId, false, removedBy, reason);
        }
        catch (error) {
            logger.error({ error, punishmentId, removedBy }, 'Erro ao remover punição do histórico');
            throw error;
        }
    }
}
