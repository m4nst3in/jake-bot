import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    PermissionFlagsBits,
    GuildMember
} from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { logger } from '../utils/logger.ts';
import { 
    loadPunishmentConfig, 
    hasPermissionToPunish, 
    canPunishTarget
} from '../utils/punishment.ts';

export default {
    data: new SlashCommandBuilder()
        .setName('despunir')
        .setDescription('Remove punições de mute aplicadas aos usuários')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para remover a punição')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('tipo')
                .setDescription('Tipo de punição a remover')
                .setRequired(true)
                .addChoices(
                    { name: 'Mute Voz', value: 'mute_voice' },
                    { name: 'Mute Chat', value: 'mute_text' },
                    { name: 'Ambos', value: 'both' }
                )
        )
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da remoção da punição')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const config = loadConfig() as any;
            const punishmentConfig = loadPunishmentConfig();
            
            // Verificar se está no servidor principal
            if (interaction.guildId !== config.mainGuildId) {
                await interaction.reply({
                    content: '❌ Este comando só pode ser usado no servidor principal.',
                    ephemeral: true
                });
                return;
            }

            const executor = interaction.member as GuildMember;
            const targetUser = interaction.options.getUser('usuario', true);
            const punishmentType = interaction.options.getString('tipo', true);
            const reason = interaction.options.getString('motivo') || 'Não especificado';
            
            const target = await interaction.guild?.members.fetch(targetUser.id);

            if (!target) {
                await interaction.reply({
                    content: '❌ Usuário não encontrado no servidor.',
                    ephemeral: true
                });
                return;
            }

            // Verificar permissões
            if (!hasPermissionToPunish(executor, punishmentType === 'both' ? 'mute_voice' : punishmentType)) {
                await interaction.reply({
                    content: '❌ Você não tem permissão para remover este tipo de punição.',
                    ephemeral: true
                });
                return;
            }

            let removedPunishments: string[] = [];
            let failedRemovals: string[] = [];

            // Remover punições baseado no tipo selecionado
            if (punishmentType === 'mute_voice' || punishmentType === 'both') {
                const voiceRoleId = config.punishmentRoles?.mutedVoice;
                if (voiceRoleId && target.roles.cache.has(voiceRoleId)) {
                    try {
                        await target.roles.remove(voiceRoleId, `Punição removida por ${executor.displayName}: ${reason}`);
                        removedPunishments.push('Mute Voz');
                    } catch (error) {
                        logger.error({ error, targetId: target.id, roleId: voiceRoleId }, 'Erro ao remover mute de voz');
                        failedRemovals.push('Mute Voz');
                    }
                }
            }

            if (punishmentType === 'mute_text' || punishmentType === 'both') {
                const textRoleId = config.punishmentRoles?.mutedChat;
                if (textRoleId && target.roles.cache.has(textRoleId)) {
                    try {
                        await target.roles.remove(textRoleId, `Punição removida por ${executor.displayName}: ${reason}`);
                        removedPunishments.push('Mute Chat');
                    } catch (error) {
                        logger.error({ error, targetId: target.id, roleId: textRoleId }, 'Erro ao remover mute de chat');
                        failedRemovals.push('Mute Chat');
                    }
                }
            }

            // Remover timeout se existir
            if (target.isCommunicationDisabled()) {
                try {
                    await target.timeout(null, `Timeout removido por ${executor.displayName}: ${reason}`);
                    removedPunishments.push('Castigo (Timeout)');
                } catch (error) {
                    logger.error({ error, targetId: target.id }, 'Erro ao remover timeout');
                    failedRemovals.push('Castigo (Timeout)');
                }
            }

            // Criar embed de resposta
            let embed: EmbedBuilder;
            
            if (removedPunishments.length > 0) {
                embed = new EmbedBuilder()
                    .setTitle('✅ Punições Removidas')
                    .setDescription(`Punições removidas com sucesso de **${target.displayName}**.`)
                    .addFields(
                        { name: '👤 Usuário', value: `<@${target.id}>`, inline: true },
                        { name: '👮 Executor', value: `<@${executor.id}>`, inline: true },
                        { name: '🔓 Punições Removidas', value: removedPunishments.join('\n'), inline: false },
                        { name: '📝 Motivo', value: reason, inline: false }
                    )
                    .setColor(0x2ECC71)
                    .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                    .setTimestamp();

                if (failedRemovals.length > 0) {
                    embed.addFields({ name: '⚠️ Falhas', value: failedRemovals.join('\n'), inline: false });
                }

                // Log da remoção
                await logPunishmentRemoval(target, removedPunishments, executor, interaction, reason);

            } else {
                embed = new EmbedBuilder()
                    .setTitle('ℹ️ Nenhuma Punição Encontrada')
                    .setDescription(`**${target.displayName}** não possui as punições especificadas para remover.`)
                    .addFields(
                        { name: '👤 Usuário', value: `<@${target.id}>`, inline: true },
                        { name: '👮 Executor', value: `<@${executor.id}>`, inline: true }
                    )
                    .setColor(0x95A5A6)
                    .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                    .setTimestamp();

                if (failedRemovals.length > 0) {
                    embed.addFields({ name: '❌ Falhas', value: failedRemovals.join('\n'), inline: false });
                }
            }

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

        } catch (error) {
            logger.error({ error }, 'Erro no comando /despunir');
            
            const errorMessage = 'Ocorreu um erro ao executar o comando de remoção de punição.';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: `❌ ${errorMessage}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `❌ ${errorMessage}`,
                    ephemeral: true
                });
            }
        }
    }
};

async function logPunishmentRemoval(
    target: GuildMember,
    removedPunishments: string[],
    executor: GuildMember,
    interaction: ChatInputCommandInteraction,
    reason: string
) {
    try {
        const config = loadConfig() as any;
        const logChannelId = config.channels?.punishmentLog;
        
        if (!logChannelId) {
            logger.warn('Canal de log de punições não configurado');
            return;
        }

        const logChannel = await interaction.guild?.channels.fetch(logChannelId);
        if (!logChannel?.isTextBased()) {
            logger.warn({ logChannelId }, 'Canal de log de punições não é um canal de texto');
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle('🔓 Sistema de Punições • Punição Removida')
            .setColor(0x2ECC71)
            .setDescription(`Punições foram removidas de um usuário.`)
            .addFields(
                { name: '👤 Usuário', value: `<@${target.id}>\n\`${target.id}\``, inline: true },
                { name: '👮 Executor', value: `<@${executor.id}>\n\`${executor.id}\``, inline: true },
                { name: '🔓 Punições Removidas', value: removedPunishments.join('\n'), inline: false },
                { name: '📝 Motivo', value: reason, inline: false },
                { name: '🕐 Horário', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
        
        logger.info({ 
            targetId: target.id, 
            executorId: executor.id, 
            removedPunishments,
            reason 
        }, 'Remoção de punição logada com sucesso');
        
    } catch (error) {
        logger.error({ error }, 'Erro ao enviar log de remoção de punição');
    }
}
