import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { PunishmentHistoryService } from '../../services/punishmentHistoryService.ts';
import { logger } from '../../utils/logger.ts';
import { isOwner, getMemberLeaderAreas, hasCrossGuildLeadership } from '../../utils/permissions.ts';

// Helper function to get punishment type display name
function getPunishmentTypeName(type: string): string {
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

export default {
    id: /^(punishment_history|punishment_stats|punishment_history_summary):/,
    async execute(interaction: ButtonInteraction) {
    try {
        const customId = interaction.customId;
        
        // Check permissions - only staff can view punishment history
        const member = interaction.member;
        const owner = isOwner(member as any);
        let isLeader = false;
        
        if (member && 'roles' in member) {
            isLeader = getMemberLeaderAreas(member as any).length > 0;
            if (!isLeader) {
                try {
                    isLeader = await hasCrossGuildLeadership(interaction.client, member.user.id);
                } catch (error) {
                    // Continue without cross-guild check
                }
            }
        }

        if (!owner && !isLeader) {
            await interaction.reply({
                content: '❌ Apenas staff pode visualizar histórico de punições.',
                ephemeral: true
            });
            return;
        }

        const punishmentHistoryService = new PunishmentHistoryService();

        if (customId.startsWith('punishment_history_summary:')) {
            // Show summary of punishment history
            const executorId = customId.split(':')[1];
            
            await interaction.deferReply({ ephemeral: true });
            
            const summaryEmbed = await punishmentHistoryService.createSummaryEmbed(
                executorId, 
                interaction.client, 
                interaction.guildId || undefined
            );
            
            const summaryButtons = punishmentHistoryService.createSummaryButtons(executorId);
            
            await interaction.editReply({
                embeds: [summaryEmbed],
                components: [summaryButtons]
            });
            
        } else if (customId.startsWith('punishment_history:')) {
            // Handle pagination and detailed history
            const parts = customId.split(':');
            const executorId = parts[1];
            const page = parseInt(parts[2]) || 1;
            const isRefresh = parts[3] === 'refresh';
            
            if (customId === 'punishment_history:close') {
                await interaction.update({
                    content: '✅ Histórico de punições fechado.',
                    embeds: [],
                    components: []
                });
                return;
            }
            
            await interaction.deferUpdate();
            
            const { embed, hasNextPage, hasPrevPage } = await punishmentHistoryService.createHistoryEmbed(
                executorId,
                interaction.client,
                page,
                5, // Page size
                interaction.guildId || undefined
            );
            
            const navigationButtons = punishmentHistoryService.createNavigationButtons(
                executorId,
                page,
                hasNextPage,
                hasPrevPage
            );
            
            await interaction.editReply({
                embeds: [embed],
                components: [navigationButtons]
            });
            
        } else if (customId.startsWith('punishment_stats:')) {
            // Show detailed statistics
            const executorId = customId.split(':')[1];
            
            await interaction.deferReply({ ephemeral: true });
            
            const stats = await punishmentHistoryService.getExecutorStatistics(
                executorId, 
                interaction.guildId || undefined
            );
            
            let executorUser;
            try {
                executorUser = await interaction.client.users.fetch(executorId);
            } catch (error) {
                executorUser = null;
            }
            
            const statsEmbed = new EmbedBuilder()
                .setTitle(`📊 Estatísticas Detalhadas - ${executorUser?.username || 'Usuário Desconhecido'}`)
                .setColor(0x9B59B6)
                .setTimestamp()
                .setThumbnail(executorUser?.displayAvatarURL() || null);
            
            const descriptionParts: string[] = [];
            
            // General statistics
            descriptionParts.push(`📈 **Estatísticas Gerais**`);
            descriptionParts.push(`• Total de punições aplicadas: **${stats.totalPunishments}**`);
            descriptionParts.push(`• Punições ainda ativas: **${stats.activePunishments}**`);
            descriptionParts.push(`• Punições nos últimos 30 dias: **${stats.recentPunishments}**`);
            
            if (stats.totalPunishments > 0) {
                const activePercentage = ((stats.activePunishments / stats.totalPunishments) * 100).toFixed(1);
                const recentPercentage = ((stats.recentPunishments / stats.totalPunishments) * 100).toFixed(1);
                descriptionParts.push(`• Taxa de punições ativas: **${activePercentage}%**`);
                descriptionParts.push(`• Atividade recente: **${recentPercentage}%**`);
            }
            
            descriptionParts.push(``);
            
            // Punishment types breakdown
            if (Object.keys(stats.punishmentsByType).length > 0) {
                descriptionParts.push(`🎯 **Distribuição Detalhada por Tipo**`);
                
                const sortedTypes = Object.entries(stats.punishmentsByType)
                    .sort(([,a], [,b]) => b - a);
                
                sortedTypes.forEach(([type, count]) => {
                    const typeName = getPunishmentTypeName(type);
                    const percentage = ((count / stats.totalPunishments) * 100).toFixed(1);
                    const barLength = Math.round((count / Math.max(...Object.values(stats.punishmentsByType))) * 10);
                    const bar = '█'.repeat(barLength) + '░'.repeat(10 - barLength);
                    
                    descriptionParts.push(`${typeName}`);
                    descriptionParts.push(`\`${bar}\` **${count}** (${percentage}%)`);
                    descriptionParts.push(``);
                });
            }
            
            // Activity analysis
            if (stats.recentPunishments > 0) {
                descriptionParts.push(`⚡ **Análise de Atividade**`);
                if (stats.recentPunishments >= 10) {
                    descriptionParts.push(`• 🔥 **Muito ativo** - ${stats.recentPunishments} punições nos últimos 30 dias`);
                } else if (stats.recentPunishments >= 5) {
                    descriptionParts.push(`• 📈 **Moderadamente ativo** - ${stats.recentPunishments} punições nos últimos 30 dias`);
                } else {
                    descriptionParts.push(`• 📊 **Baixa atividade** - ${stats.recentPunishments} punições nos últimos 30 dias`);
                }
                descriptionParts.push(``);
            }
            
            descriptionParts.push(`💡 **Dica:** Use "Ver Histórico Completo" para detalhes de cada punição.`);
            
            statsEmbed.setDescription(descriptionParts.join('\n'));
            
            // Add footer with additional info
            statsEmbed.setFooter({
                text: `Sistema de Histórico de Punições - CDW • ID: ${executorId}`,
                iconURL: interaction.guild?.iconURL() || undefined
            });
            
            await interaction.editReply({
                embeds: [statsEmbed],
                components: [punishmentHistoryService.createSummaryButtons(executorId)]
            });
        }
        
    } catch (error) {
        logger.error({ error, customId: interaction.customId }, 'Erro ao processar interação do histórico de punições');
        
        const errorMessage = 'Ocorreu um erro ao carregar o histórico de punições.';
        
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: `❌ ${errorMessage}`,
                embeds: [],
                components: []
            });
        } else {
            await interaction.reply({
                content: `❌ ${errorMessage}`,
                ephemeral: true
            });
        }
    }
    }
}
