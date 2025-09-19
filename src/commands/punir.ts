import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, GuildMember, User, ModalBuilder, TextInputBuilder, TextInputStyle, ComponentType, Message } from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { logger } from '../utils/logger.ts';
import { isOwner } from '../utils/permissions.ts';
import { loadPunishmentConfig, hasPermissionToPunish, canPunishTarget, logPunishment as logPunishmentUtil, createPunishmentEmbed, calculateExpirationTime, removePunishmentRole } from '../utils/punishment.ts';
interface PunishmentData {
    id: string;
    name: string;
    duration?: number;
    durationType?: string;
    type: string;
    reason: string;
    bannable?: boolean;
}
async function applyPunishment(target: GuildMember, punishment: PunishmentData, executor: GuildMember, interaction: ChatInputCommandInteraction, proofUrl?: string): Promise<boolean> {
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
                if (duration > 0) {
                    setTimeout(async () => {
                        try {
                            await target.roles.remove(punishmentType.roleId, 'Punição expirada');
                        }
                        catch (error) {
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
        await logPunishmentUtil(target, punishment, executor, interaction.guild!, punishmentType, proofUrl);
        logger.info({
            targetId: target.id,
            executorId: executor.id,
            punishmentType: punishment.type,
            reason: punishment.reason,
            proofUrl: proofUrl || 'N/A'
        }, 'Punição aplicada com sucesso');
        return true;
    }
    catch (error) {
        logger.error({ error, targetId: target.id, punishment }, 'Erro ao aplicar punição');
        return false;
    }
}
export default {
    data: new SlashCommandBuilder()
        .setName('punir')
        .setDescription('Aplica punições pré-determinadas aos usuários')
        .addUserOption(option => option.setName('usuario')
        .setDescription('Usuário a ser punido')
        .setRequired(true))
        .setDefaultMemberPermissions(null)
        .setDMPermission(false),
    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const config = loadConfig();
            const punishmentConfig = loadPunishmentConfig();
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
            const canPunish = canPunishTarget(executor, target);
            if (!canPunish.canPunish) {
                await interaction.reply({
                    content: `❌ ${canPunish.reason}`,
                    ephemeral: true
                });
                return;
            }
            const embed = new EmbedBuilder()
                .setTitle('<a:mov_call10:1191155269258973214> Punições - CDW')
                .setDescription(`Selecione a categoria da punição para **${target.displayName}**`)
                .setColor(0x3498DB)
                .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                .setTimestamp();
            const availableCategories = Object.entries(punishmentConfig.punishmentCategories).filter(([key, category]: [
                string,
                any
            ]) => {
                if (key === 'severe') {
                    if (isOwner(executor))
                        return true;
                    const permissionRoles = [
                        '1136699869290041404',
                        '1104523865377488918',
                        '1080746284434071582',
                        '1156383581099274250',
                        '1271086030984052788'
                    ];
                    return permissionRoles.some(roleId => executor.roles.cache.has(roleId));
                }
                return true;
            });
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('punishment_category')
                .setPlaceholder('Selecione uma categoria de punição...')
                .addOptions(availableCategories.map(([key, category]: [
                string,
                any
            ]) => ({
                label: category.name,
                description: category.description,
                value: key,
                emoji: category.emoji
            })));
            const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                .addComponents(selectMenu);
            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true
            });
            const response = await interaction.fetchReply();
            const collector = response.createMessageComponentCollector({
                time: 300000
            });
            collector.on('collect', async (i: any) => {
                if (i.user.id !== executor.id) {
                    await i.reply({
                        content: '<a:nao:1293359397040427029> Apenas quem executou o comando pode interagir.',
                        ephemeral: true
                    });
                    return;
                }
                if (i.isStringSelectMenu() && i.customId === 'punishment_category') {
                    const categoryKey = i.values[0];
                    const category = punishmentConfig.punishmentCategories[categoryKey];
                    const categoryEmbed = new EmbedBuilder()
                        .setTitle(`${category.emoji} ${category.name}`)
                        .setDescription(category.description)
                        .setColor(0xE67E22)
                        .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                        .setTimestamp();
                    if (category.note) {
                        categoryEmbed.addFields({ name: '⚠️ Observação', value: category.note, inline: false });
                    }
                    const punishmentSelect = new StringSelectMenuBuilder()
                        .setCustomId(`punishment_select_${categoryKey}`)
                        .setPlaceholder('Selecione uma punição...')
                        .addOptions(category.punishments.map((punishment: PunishmentData) => {
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
                    }));
                    const punishmentRow = new ActionRowBuilder<StringSelectMenuBuilder>()
                        .addComponents(punishmentSelect);
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
                            content: '<a:nao:1293359397040427029> Punição não encontrada.',
                            ephemeral: true
                        });
                        return;
                    }
                    if (!hasPermissionToPunish(executor, punishment.type)) {
                        await i.reply({
                            content: '<a:nao:1293359397040427029> Você não tem permissão para aplicar este tipo de punição.',
                            ephemeral: true
                        });
                        return;
                    }
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
                        .setTitle('<a:mov_call10:1191155269258973214> Confirmação de Punição')
                        .setDescription(`Tem certeza que deseja aplicar esta punição?`)
                        .addFields({ name: '<a:mov_call1:1252739847614103687> Usuário', value: `<@${target.id}>`, inline: true }, { name: '<a:mov_call1:1252739847614103687> Punição', value: punishmentType.name, inline: true }, { name: '<a:mov_call1:1252739847614103687> Duração', value: durationText, inline: true }, { name: '<a:mov_call1:1252739847614103687> Motivo', value: punishment.reason, inline: false })
                        .setColor(0xE74C3C)
                        .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                        .setTimestamp();
                    const confirmButton = new ButtonBuilder()
                        .setCustomId(`confirm_punishment_${punishmentId}`)
                        .setLabel('Confirmar')
                        .setStyle(ButtonStyle.Danger);
                    const cancelButton = new ButtonBuilder()
                        .setCustomId('cancel_punishment')
                        .setLabel('Cancelar')
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
                        const embed = new EmbedBuilder()
                            .setTitle('<a:mov_call1:1252739847614103687> Sistema de Punições')
                            .setDescription(`Selecione a categoria de punição para **${target.displayName}**`)
                            .setColor(0x3498DB)
                            .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                            .setTimestamp();
                        const selectMenu = new StringSelectMenuBuilder()
                            .setCustomId('punishment_category')
                            .setPlaceholder('Selecione uma categoria de punição...')
                            .addOptions(Object.entries(punishmentConfig.punishmentCategories).map(([key, category]: [
                            string,
                            any
                        ]) => ({
                            label: category.name,
                            description: category.description,
                            value: key,
                            emoji: category.emoji
                        })));
                        const row = new ActionRowBuilder<StringSelectMenuBuilder>()
                            .addComponents(selectMenu);
                        await i.update({
                            embeds: [embed],
                            components: [row]
                        });
                    }
                    if (i.customId.startsWith('confirm_punishment_')) {
                        const punishmentId = i.customId.replace('confirm_punishment_', '');
                        let punishment: PunishmentData | null = null;
                        for (const category of Object.values(punishmentConfig.punishmentCategories)) {
                            punishment = (category as any).punishments.find((p: PunishmentData) => p.id === punishmentId);
                            if (punishment)
                                break;
                        }
                        if (!punishment) {
                            await i.reply({
                                content: '<a:nao:1293359397040427029> Punição não encontrada.',
                                ephemeral: true
                            });
                            return;
                        }
                        const proofEmbed = new EmbedBuilder()
                            .setTitle('<a:mov_call1:1252739847614103687> Prova Necessária')
                            .setDescription(`Para aplicar a punição **${punishmentConfig.punishmentTypes[punishment.type].name}** em **${target.displayName}**, você deve enviar uma prova (print, vídeo, etc.).`)
                            .addFields({ name: '<a:setabranca:1417092970380791850> Instruções', value: 'Envie sua mensagem com o anexo da prova nos próximos 5 minutos.', inline: false }, { name: '<a:setabranca:1417092970380791850> Motivo', value: punishment.reason, inline: false })
                            .setColor(0xF39C12)
                            .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                            .setTimestamp();
                        const cancelProofButton = new ButtonBuilder()
                            .setCustomId('cancel_proof_request')
                            .setLabel('Cancelar')
                            .setStyle(ButtonStyle.Secondary);
                        const proofRow = new ActionRowBuilder<ButtonBuilder>()
                            .addComponents(cancelProofButton);
                        await i.update({
                            embeds: [proofEmbed],
                            components: [proofRow]
                        });
                        try {
                            const filter = (msg: Message) => msg.author.id === executor.id && msg.attachments.size > 0;
                            const channel = interaction.channel;
                            if (!channel || !('awaitMessages' in channel)) {
                                throw new Error('Canal não suporta aguardar mensagens');
                            }
                            const proofMessage = await channel.awaitMessages({
                                filter,
                                max: 1,
                                time: 300000,
                                errors: ['time']
                            });
                            if (proofMessage && proofMessage.size > 0) {
                                const proof = proofMessage.first();
                                const firstAttachment = proof?.attachments.first();
                                // URL direta do arquivo enviado pelo executor (pode expirar se a msg for deletada)
                                const originalProofFileUrl = firstAttachment?.url;
                                // URLs salvas no canal de backup (mensagem e anexo)
                                let storageMessageUrl: string | undefined;
                                let storageAttachmentUrl: string | undefined;
                                try {
                                    const proofGuildId = '1405418716258111580';
                                    const proofChannelId = '1413999392939180032';
                                    const proofGuild = interaction.client.guilds.cache.get(proofGuildId);
                                    if (proofGuild) {
                                        const proofChannel = proofGuild.channels.cache.get(proofChannelId);
                                        if (proofChannel?.isTextBased()) {
                                            const content = [
                                                `📋 Prova de Punição`,
                                                `Executor: <@${executor.id}> (\`${executor.id}\`)`,
                                                `Alvo: <@${target.id}> (\`${target.id}\`)`,
                                                `Punição: ${punishmentConfig.punishmentTypes[punishment.type].name}`,
                                                `Motivo: ${punishment.reason}`
                                            ].join('\n');
                                            const files = firstAttachment ? [firstAttachment.url] : [];
                                            const savedMessage = await proofChannel.send({ content, files });
                                            storageMessageUrl = savedMessage.url; // link para consulta humana
                                            storageAttachmentUrl = savedMessage.attachments.first()?.url || originalProofFileUrl || undefined; // URL do arquivo estável para usar no embed de log
                                            logger.info({
                                                executorId: executor.id,
                                                targetId: target.id,
                                                savedMessageId: savedMessage.id
                                            }, 'Prova salva no canal de backup');
                                        }
                                    }
                                }
                                catch (error) {
                                    logger.error({ error }, 'Erro ao salvar prova no canal de backup');
                                }
                                // Delete the user's proof message immediately after capturing/saving it
                                try {
                                    await proof?.delete();
                                }
                                catch (error) {
                                    logger.warn({ error }, 'Não foi possível deletar mensagem da prova imediatamente');
                                }
                                // Preferimos a URL do anexo salvo no canal de backup; caso falhe, usamos a URL original
                                const proofForLogging = storageAttachmentUrl || originalProofFileUrl;
                                const success = await applyPunishment(target, punishment, executor, interaction, proofForLogging);
                                if (success) {
                                    const successEmbed = new EmbedBuilder()
                                        .setTitle('<a:sim:1293359353180454933> Punição Aplicada')
                                        .setDescription(`A punição foi aplicada com sucesso em **${target.displayName}**.`)
                                        .addFields(
                                            { name: '<a:mov_call1:1252739847614103687> Punição', value: punishmentConfig.punishmentTypes[punishment.type].name, inline: true },
                                            { name: '<a:mov_call1:1252739847614103687> Motivo', value: punishment.reason, inline: false },
                                            // Mostramos o link da mensagem de armazenamento (quando existir) para referência do executor
                                            { name: '<a:mov_call1:1252739847614103687> Prova', value: storageMessageUrl ? `[Anexo armazenado](${storageMessageUrl})` : (proofForLogging ? `[Anexo enviado](${proofForLogging})` : '—'), inline: false }
                                        )
                                        .setColor(0x2ECC71)
                                        .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                                        .setTimestamp();
                                    await i.editReply({
                                        embeds: [successEmbed],
                                        components: []
                                    });
                                }
                                else {
                                    const errorEmbed = new EmbedBuilder()
                                        .setTitle('<a:nao:1293359397040427029> Erro ao Aplicar Punição')
                                        .setDescription('Ocorreu um erro ao aplicar a punição. Verifique os logs para mais detalhes.')
                                        .setColor(0xE74C3C)
                                        .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                                        .setTimestamp();
                                    await i.editReply({
                                        embeds: [errorEmbed],
                                        components: []
                                    });
                                }
                            }
                        }
                        catch (error) {
                            const timeoutEmbed = new EmbedBuilder()
                                .setTitle('⏰ Tempo Esgotado')
                                .setDescription('Não foi enviada uma prova dentro do tempo limite. A punição foi cancelada.')
                                .setColor(0x95A5A6)
                                .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                                .setTimestamp();
                            await i.editReply({
                                embeds: [timeoutEmbed],
                                components: []
                            });
                        }
                        collector.stop();
                    }
                    if (i.customId === 'cancel_proof_request') {
                        const cancelEmbed = new EmbedBuilder()
                            .setTitle('<a:nao:1293359397040427029> Solicitação de Prova Cancelada')
                            .setDescription('A solicitação de prova foi cancelada. A punição não foi aplicada.')
                            .setColor(0x95A5A6)
                            .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
                            .setTimestamp();
                        await i.update({
                            embeds: [cancelEmbed],
                            components: []
                        });
                        collector.stop();
                    }
                    if (i.customId === 'cancel_punishment') {
                        const cancelEmbed = new EmbedBuilder()
                            .setTitle('<a:nao:1293359397040427029> Punição Cancelada')
                            .setDescription('A aplicação da punição foi cancelada.')
                            .setColor(0x95A5A6)
                            .setFooter({ text: 'Sistema de Punições - CDW', iconURL: interaction.guild?.iconURL() || undefined })
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
            });
        }
        catch (error) {
            logger.error({ error }, 'Erro no comando /punir');
            const errorMessage = 'Ocorreu um erro ao executar o comando de punição.';
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: `<a:nao:1293359397040427029> ${errorMessage}`,
                    ephemeral: true
                });
            }
            else {
                await interaction.reply({
                    content: `<a:nao:1293359397040427029> ${errorMessage}`,
                    ephemeral: true
                });
            }
        }
    }
};
