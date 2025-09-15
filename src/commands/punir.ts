import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    PermissionFlagsBits,
    GuildMember,
    User
} from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { logger } from '../utils/logger.ts';
import { 
    loadPunishmentConfig, 
    hasPermissionToPunish, 
    canPunishTarget, 
    logPunishment as logPunishmentUtil, 
    createPunishmentEmbed,
    calculateExpirationTime,
    removePunishmentRole
} from '../utils/punishment.ts';

interface PunishmentData {
    id: string;
    name: string;
    duration?: number;
    durationType?: string;
    type: string;
    reason: string;
    bannable?: boolean;
}

async function applyPunishment(
    target: GuildMember, 
    punishment: PunishmentData, 
    executor: GuildMember,
    interaction: ChatInputCommandInteraction
): Promise<boolean> {
    try {
        const config = loadConfig();
        const punishmentConfig = loadPunishmentConfig();
        const punishmentType = punishmentConfig.punishmentTypes[punishment.type];

        if (!punishmentType) {
            throw new Error(`Tipo de punição desconhecido: ${punishment.type}`);
        }

        let duration = 0;
        if (punishment.duration && punishment.durationType) {
            switch (punishment.durationType) {
                case 'minutes':
                    duration = punishment.duration * 60 * 1000;
                    break;
                case 'hours':
                    duration = punishment.duration * 60 * 60 * 1000;
                    break;
                case 'days':
                    duration = punishment.duration * 24 * 60 * 60 * 1000;
                    break;
            }
        }

        switch (punishmentType.type) {
            case 'role_add':
                await target.roles.add(punishmentType.roleId, `Punição aplicada por ${executor.displayName}: ${punishment.reason}`);
                
                // Se tem duração, remover o cargo após o tempo
                if (duration > 0) {
                    setTimeout(async () => {
                        try {
                            await target.roles.remove(punishmentType.roleId, 'Punição expirada');
                        } catch (error) {
                            logger.error({ error, targetId: target.id, roleId: punishmentType.roleId }, 'Erro ao remover cargo de punição expirado');
                        }
                    }, duration);
                }
                break;

            case 'timeout':
                if (duration > 0) {
                    await target.timeout(duration, `Punição aplicada por ${executor.displayName}: ${punishment.reason}`);
                }
                break;

            case 'ban':
                await target.ban({ 
                    reason: `Punição aplicada por ${executor.displayName}: ${punishment.reason}`,
                    deleteMessageSeconds: 0
                });
                break;

            default:
                throw new Error(`Tipo de punição não implementado: ${punishmentType.type}`);
        }

        // Log da punição
        await logPunishmentUtil(target, punishment, executor, interaction.guild!, punishmentType);

        return true;
    } catch (error) {
        logger.error({ error, targetId: target.id, punishment }, 'Erro ao aplicar punição');
        return false;
    }
}


export default {
    data: new SlashCommandBuilder()
        .setName('punir')
        .setDescription('Aplica punições pré-determinadas aos usuários')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário a ser punido')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const config = loadConfig();
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
            const target = await interaction.guild?.members.fetch(targetUser.id);

            if (!target) {
                await interaction.reply({
                    content: '❌ Usuário não encontrado no servidor.',
                    ephemeral: true
                });
                return;
            }

            // Verificar se o usuário pode ser punido
            const canPunish = canPunishTarget(executor, target);
            if (!canPunish.canPunish) {
                await interaction.reply({
                    content: `❌ ${canPunish.reason}`,
                    ephemeral: true
                });
                return;
            }

            // Criar embed inicial com categorias
            const embed = new EmbedBuilder()
                .setTitle('🔨 Sistema de Punições')
                .setDescription(`Selecione a categoria de punição para **${target.displayName}**`)
                .setColor(0x3498DB)
                .setFooter({ text: 'Sistema de Punições - CDW' })
                .setTimestamp();

            // Criar select menu com categorias
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('punishment_category')
                .setPlaceholder('Selecione uma categoria de punição...')
                .addOptions(
                    Object.entries(punishmentConfig.punishmentCategories).map(([key, category]: [string, any]) => ({
                        label: category.name,
                        description: category.description,
                        value: key,
                        emoji: category.emoji
                    }))
                );

            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(selectMenu);

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });

            // Collector para o select menu
            const response = await interaction.fetchReply();
            const collector = response.createMessageComponentCollector({
                time: 300000 // 5 minutos
            });

            collector.on('collect', async (i: any) => {
                if (i.user.id !== executor.id) {
                    await i.reply({
                        content: '❌ Apenas quem executou o comando pode interagir.',
                        ephemeral: true
                    });
                    return;
                }

                if (i.isStringSelectMenu() && i.customId === 'punishment_category') {
                    const categoryKey = i.values[0];
                    const category = punishmentConfig.punishmentCategories[categoryKey];

                    // Criar embed com punições da categoria
                    const categoryEmbed = new EmbedBuilder()
                        .setTitle(`${category.emoji} ${category.name}`)
                        .setDescription(category.description)
                        .setColor(0xE67E22)
                        .setFooter({ text: 'Sistema de Punições - CDW' })
                        .setTimestamp();

                    if (category.note) {
                        categoryEmbed.addFields({ name: '⚠️ Observação', value: category.note, inline: false });
                    }

                    // Criar select menu com punições
                    const punishmentSelect = new StringSelectMenuBuilder()
                        .setCustomId(`punishment_select_${categoryKey}`)
                        .setPlaceholder('Selecione uma punição...')
                        .addOptions(
                            category.punishments.map((punishment: PunishmentData) => {
                                let description = punishment.reason;
                                if (punishment.duration && punishment.durationType) {
                                    const durationMap = {
                                        'minutes': 'min',
                                        'hours': 'h',
                                        'days': 'd'
                                    };
                                    description += ` (${punishment.duration}${durationMap[punishment.durationType as keyof typeof durationMap]})`;
                                }
                                
                                return {
                                    label: punishment.name,
                                    description: description.length > 100 ? description.substring(0, 97) + '...' : description,
                                    value: punishment.id
                                };
                            })
                        );

                    const punishmentRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                        .addComponents(punishmentSelect);

                    // Botão de voltar
                    const backButton = new ButtonBuilder()
                        .setCustomId('back_to_categories')
                        .setLabel('← Voltar')
                        .setStyle(ButtonStyle.Secondary);

                    const buttonRow = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(backButton);

                    await i.update({
                        embeds: [categoryEmbed],
                        components: [punishmentRow, buttonRow]
                    });
                }

                if (i.isStringSelectMenu() && i.customId.startsWith('punishment_select_')) {
                    const categoryKey = i.customId.replace('punishment_select_', '');
                    const category = punishmentConfig.punishmentCategories[categoryKey];
                    const punishmentId = i.values[0];
                    const punishment = category.punishments.find((p: PunishmentData) => p.id === punishmentId);

                    if (!punishment) {
                        await i.reply({
                            content: '❌ Punição não encontrada.',
                            ephemeral: true
                        });
                        return;
                    }

                    // Verificar permissões
                    if (!hasPermissionToPunish(executor, punishment.type)) {
                        await i.reply({
                            content: '❌ Você não tem permissão para aplicar este tipo de punição.',
                            ephemeral: true
                        });
                        return;
                    }

                    // Criar embed de confirmação
                    const punishmentType = punishmentConfig.punishmentTypes[punishment.type];
                    let durationText = 'Permanente';
                    if (punishment.duration && punishment.durationType) {
                        const durationMap = {
                            'minutes': 'minutos',
                            'hours': 'horas',
                            'days': 'dias'
                        };
                        durationText = `${punishment.duration} ${durationMap[punishment.durationType as keyof typeof durationMap]}`;
                    }

                    const confirmEmbed = new EmbedBuilder()
                        .setTitle('⚠️ Confirmação de Punição')
                        .setDescription(`Tem certeza que deseja aplicar esta punição?`)
                        .addFields(
                            { name: '👤 Usuário', value: `<@${target.id}>`, inline: true },
                            { name: '⚖️ Punição', value: punishmentType.name, inline: true },
                            { name: '⏱️ Duração', value: durationText, inline: true },
                            { name: '📝 Motivo', value: punishment.reason, inline: false }
                        )
                        .setColor(0xE74C3C)
                        .setFooter({ text: 'Esta ação não pode ser desfeita automaticamente' })
                        .setTimestamp();

                    const confirmButton = new ButtonBuilder()
                        .setCustomId(`confirm_punishment_${punishmentId}`)
                        .setLabel('✅ Confirmar')
                        .setStyle(ButtonStyle.Danger);

                    const cancelButton = new ButtonBuilder()
                        .setCustomId('cancel_punishment')
                        .setLabel('❌ Cancelar')
                        .setStyle(ButtonStyle.Secondary);

                    const confirmRow = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(confirmButton, cancelButton);

                    await i.update({
                        embeds: [confirmEmbed],
                        components: [confirmRow]
                    });
                }

                if (i.isButton()) {
                    if (i.customId === 'back_to_categories') {
                        // Voltar para as categorias
                        const embed = new EmbedBuilder()
                            .setTitle('🔨 Sistema de Punições')
                            .setDescription(`Selecione a categoria de punição para **${target.displayName}**`)
                            .setColor(0x3498DB)
                            .setFooter({ text: 'Sistema de Punições - CDW' })
                            .setTimestamp();

                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId('punishment_category')
                            .setPlaceholder('Selecione uma categoria de punição...')
                            .addOptions(
                                Object.entries(punishmentConfig.punishmentCategories).map(([key, category]: [string, any]) => ({
                                    label: category.name,
                                    description: category.description,
                                    value: key,
                                    emoji: category.emoji
                                }))
                            );

                        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                            .addComponents(selectMenu);

                        await i.update({
                            embeds: [embed],
                            components: [row]
                        });
                    }

                    if (i.customId.startsWith('confirm_punishment_')) {
                        const punishmentId = i.customId.replace('confirm_punishment_', '');
                        
                        // Encontrar a punição
                        let punishment: PunishmentData | null = null;
                        for (const category of Object.values(punishmentConfig.punishmentCategories)) {
                            punishment = (category as any).punishments.find((p: PunishmentData) => p.id === punishmentId);
                            if (punishment) break;
                        }

                        if (!punishment) {
                            await i.reply({
                                content: '❌ Punição não encontrada.',
                                ephemeral: true
                            });
                            return;
                        }

                        await i.deferUpdate();

                        // Aplicar punição
                        const success = await applyPunishment(target, punishment, executor, interaction);

                        if (success) {
                            const successEmbed = new EmbedBuilder()
                                .setTitle('✅ Punição Aplicada')
                                .setDescription(`A punição foi aplicada com sucesso em **${target.displayName}**.`)
                                .addFields(
                                    { name: '⚖️ Punição', value: punishmentConfig.punishmentTypes[punishment.type].name, inline: true },
                                    { name: '📝 Motivo', value: punishment.reason, inline: false }
                                )
                                .setColor(0x2ECC71)
                                .setFooter({ text: 'Sistema de Punições - CDW' })
                                .setTimestamp();

                            await i.editReply({
                                embeds: [successEmbed],
                                components: []
                            });
                        } else {
                            const errorEmbed = new EmbedBuilder()
                                .setTitle('❌ Erro ao Aplicar Punição')
                                .setDescription('Ocorreu um erro ao aplicar a punição. Verifique os logs para mais detalhes.')
                                .setColor(0xE74C3C)
                                .setFooter({ text: 'Sistema de Punições - CDW' })
                                .setTimestamp();

                            await i.editReply({
                                embeds: [errorEmbed],
                                components: []
                            });
                        }

                        collector.stop();
                    }

                    if (i.customId === 'cancel_punishment') {
                        const cancelEmbed = new EmbedBuilder()
                            .setTitle('❌ Punição Cancelada')
                            .setDescription('A aplicação da punição foi cancelada.')
                            .setColor(0x95A5A6)
                            .setFooter({ text: 'Sistema de Punições - CDW' })
                            .setTimestamp();

                        await i.update({
                            embeds: [cancelEmbed],
                            components: []
                        });

                        collector.stop();
                    }
                }
            });

            collector.on('end', () => {
                // Collector expirado - não fazer nada, a mensagem já foi editada
            });

        } catch (error) {
            logger.error({ error }, 'Erro no comando /punir');
            
            const errorMessage = 'Ocorreu um erro ao executar o comando de punição.';
            
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
