import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    PermissionFlagsBits,
    GuildMember,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ComponentType
} from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { logger } from '../utils/logger.ts';
import { 
    loadPunishmentConfig, 
    hasPermissionToPunish, 
    canPunishTarget,
    canRemovePunishment
} from '../utils/punishment.ts';

interface ActivePunishment {
    type: string;
    name: string;
    roleId?: string;
    isTimeout?: boolean;
    expiresAt?: Date;
}

export default {
    data: new SlashCommandBuilder()
        .setName('despunir')
        .setDescription('Remove punições ativas de um usuário')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para remover punições')
                .setRequired(true)
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
                    content: '<a:nao:1293359397040427029> Este comando só pode ser usado no servidor principal.',
                    ephemeral: true
                });
                return;
            }

            const executor = interaction.member as GuildMember;
            const targetUser = interaction.options.getUser('usuario', true);
            
            const target = await interaction.guild?.members.fetch(targetUser.id);

            if (!target) {
                await interaction.reply({
                    content: '<a:nao:1293359397040427029> Usuário não encontrado no servidor.',
                    ephemeral: true
                });
                return;
            }

            // Verificar permissões específicas para remoção de punições
            const permissionCheck = canRemovePunishment(executor, target.id);
            if (!permissionCheck.canRemove) {
                await interaction.reply({
                    content: `<a:nao:1293359397040427029> ${permissionCheck.reason}`,
                    ephemeral: true
                });
                return;
            }

            // Detectar punições ativas
            const activePunishments: ActivePunishment[] = [];

            // Verificar mute de voz
            const voiceRoleId = config.punishmentRoles?.mutedVoice;
            if (voiceRoleId && target.roles.cache.has(voiceRoleId)) {
                activePunishments.push({
                    type: 'mute_voice',
                    name: 'Mute Voz',
                    roleId: voiceRoleId
                });
            }

            // Verificar mute de chat
            const textRoleId = config.punishmentRoles?.mutedChat;
            if (textRoleId && target.roles.cache.has(textRoleId)) {
                activePunishments.push({
                    type: 'mute_text',
                    name: 'Mute Chat',
                    roleId: textRoleId
                });
            }

            // Verificar timeout
            if (target.isCommunicationDisabled()) {
                const timeoutEnd = target.communicationDisabledUntil;
                activePunishments.push({
                    type: 'timeout',
                    name: 'Castigo (Timeout)',
                    isTimeout: true,
                    expiresAt: timeoutEnd || undefined
                });
            }

            // Se não há punições ativas
            if (activePunishments.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('<:cdw_white_pomba:1137012314445463663> Nenhuma Punição Ativa')
                    .setDescription(`**${target.displayName}** não possui punições ativas para remover.`)
                    .addFields(
                        { name: '<a:setabranca:1417092970380791850> Usuário', value: `<@${target.id}>`, inline: true },
                        { name: '<a:setabranca:1417092970380791850> Verificado por', value: `<@${executor.id}>`, inline: true }
                    )
                    .setColor(0x95A5A6)
                    .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                    .setTimestamp();

                await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
                return;
            }

            // Se há apenas uma punição, remover diretamente
            if (activePunishments.length === 1) {
                const punishment = activePunishments[0];
                const success = await removePunishment(target, punishment, executor);
                
                const embed = new EmbedBuilder()
                    .setTitle('<:cdw_white_pomba:1137012314445463663> Punição Removida')
                    .setDescription(`Punição removida com sucesso de **${target.displayName}**.`)
                    .addFields(
                        { name: '<a:setabranca:1417092970380791850> Usuário', value: `<@${target.id}>`, inline: true },
                        { name: '<a:setabranca:1417092970380791850> Executor', value: `<@${executor.id}>`, inline: true },
                        { name: '<a:setabranca:1417092970380791850> Punição Removida', value: punishment.name, inline: false }
                    )
                    .setColor(success ? 0x2ECC71 : 0xE74C3C)
                    .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                    .setTimestamp();

                if (success) {
                    await logPunishmentRemoval(target, [punishment.name], executor, interaction);
                }

                await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
                return;
            }

            // Se há múltiplas punições, mostrar seleção
            const embed = new EmbedBuilder()
                .setTitle('<a:mov_call1:1252739847614103687> Selecionar Punição')
                .setDescription(`**${target.displayName}** possui múltiplas punições ativas. Selecione qual deseja remover:`)
                .addFields(
                    { name: '<a:setabranca:1417092970380791850> Usuário', value: `<@${target.id}>`, inline: true },
                    { name: '<a:setabranca:1417092970380791850> Punições Ativas', value: activePunishments.map(p => `• ${p.name}`).join('\n'), inline: false }
                )
                .setColor(0x3498DB)
                .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                .setTimestamp();

            const buttons: ButtonBuilder[] = [];
            activePunishments.forEach((punishment, index) => {
                buttons.push(
                    new ButtonBuilder()
                        .setCustomId(`remove_punishment_${punishment.type}_${target.id}`)
                        .setLabel(punishment.name)
                        .setStyle(ButtonStyle.Danger)
                );
            });

            // Adicionar botão para remover todas
            buttons.push(
                new ButtonBuilder()
                    .setCustomId(`remove_all_punishments_${target.id}`)
                    .setLabel('Remover Todas')
                    .setStyle(ButtonStyle.Secondary)
            );

            const rows: ActionRowBuilder<ButtonBuilder>[] = [];
            for (let i = 0; i < buttons.length; i += 5) {
                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(buttons.slice(i, i + 5));
                rows.push(row);
            }

            const response = await interaction.reply({
                embeds: [embed],
                components: rows,
                ephemeral: true
            });

            // Aguardar interação do botão
            try {
                const confirmation = await response.awaitMessageComponent({
                    componentType: ComponentType.Button,
                    time: 60000
                });

                const customId = confirmation.customId;
                let removedPunishments: string[] = [];

                if (customId.startsWith('remove_all_punishments_')) {
                    // Remover todas as punições
                    for (const punishment of activePunishments) {
                        const success = await removePunishment(target, punishment, executor);
                        if (success) {
                            removedPunishments.push(punishment.name);
                        }
                    }
                } else {
                    // Remover punição específica
                    const punishmentType = customId.split('_')[2];
                    const punishment = activePunishments.find(p => p.type === punishmentType);
                    
                    if (punishment) {
                        const success = await removePunishment(target, punishment, executor);
                        if (success) {
                            removedPunishments.push(punishment.name);
                        }
                    }
                }

                const resultEmbed = new EmbedBuilder()
                    .setTitle('<:cdw_white_pomba:1137012314445463663> Punições Removidas')
                    .setDescription(`Punições removidas com sucesso de **${target.displayName}**.`)
                    .addFields(
                        { name: '<a:setabranca:1417092970380791850> Usuário', value: `<@${target.id}>`, inline: true },
                        { name: '<a:setabranca:1417092970380791850> Executor', value: `<@${executor.id}>`, inline: true },
                        { name: '<a:setabranca:1417092970380791850> Punições Removidas', value: removedPunishments.join('\n') || 'Nenhuma', inline: false }
                    )
                    .setColor(removedPunishments.length > 0 ? 0x2ECC71 : 0xE74C3C)
                    .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                    .setTimestamp();

                if (removedPunishments.length > 0) {
                    await logPunishmentRemoval(target, removedPunishments, executor, interaction);
                }

                await confirmation.update({
                    embeds: [resultEmbed],
                    components: []
                });

            } catch (error) {
                const timeoutEmbed = new EmbedBuilder()
                    .setTitle('⏰ Tempo Esgotado')
                    .setDescription('O tempo para selecionar a punição expirou.')
                    .setColor(0x95A5A6);

                await interaction.editReply({
                    embeds: [timeoutEmbed],
                    components: []
                });
            }


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

async function removePunishment(
    target: GuildMember,
    punishment: ActivePunishment,
    executor: GuildMember
): Promise<boolean> {
    try {
        if (punishment.isTimeout) {
            await target.timeout(null, `Timeout removido por ${executor.displayName}`);
        } else if (punishment.roleId) {
            await target.roles.remove(punishment.roleId, `Punição removida por ${executor.displayName}`);
        }
        
        logger.info({ 
            targetId: target.id, 
            executorId: executor.id, 
            punishmentType: punishment.type 
        }, 'Punição removida com sucesso');
        
        return true;
    } catch (error) {
        logger.error({ 
            error, 
            targetId: target.id, 
            punishmentType: punishment.type 
        }, 'Erro ao remover punição');
        
        return false;
    }
}

async function logPunishmentRemoval(
    target: GuildMember,
    removedPunishments: string[],
    executor: GuildMember,
    interaction: ChatInputCommandInteraction
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
            .setTitle('<:cdw_white_pomba:1137012314445463663> Sistema de Punições • Punição Removida')
            .setColor(0x2ECC71)
            .setDescription(`Punições foram removidas de um usuário.`)
            .addFields(
                { name: '<a:setabranca:1417092970380791850> Usuário', value: `<@${target.id}>\n\`${target.id}\``, inline: true },
                { name: '<a:setabranca:1417092970380791850> Executor', value: `<@${executor.id}>\n\`${executor.id}\``, inline: true },
                { name: '<a:setabranca:1417092970380791850> Punições Removidas', value: removedPunishments.join('\n'), inline: false },
                { name: '<a:setabranca:1417092970380791850> Horário', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
            .setTimestamp();

        await logChannel.send({ embeds: [embed] });
        
        logger.info({ 
            targetId: target.id, 
            executorId: executor.id, 
            removedPunishments
        }, 'Remoção de punição logada com sucesso');
        
    } catch (error) {
        logger.error({ error }, 'Erro ao enviar log de remoção de punição');
    }
}
