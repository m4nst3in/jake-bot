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
    getUserHighestRank,
    formatDuration
} from '../utils/punishment.ts';

export default {
    data: new SlashCommandBuilder()
        .setName('status-punicao')
        .setDescription('Verifica o status de punições de um usuário')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para verificar punições')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .setDMPermission(false),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const config = loadConfig() as any;
            
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

            // Verificar permissões básicas
            if (!hasPermissionToPunish(executor, 'mute_voice')) {
                await interaction.reply({
                    content: '❌ Você não tem permissão para verificar status de punições.',
                    ephemeral: true
                });
                return;
            }

            // Verificar punições ativas
            const activePunishments: string[] = [];
            const punishmentDetails: string[] = [];

            // Verificar mute de voz
            const voiceRoleId = config.punishmentRoles?.mutedVoice;
            if (voiceRoleId && target.roles.cache.has(voiceRoleId)) {
                activePunishments.push('🔇 Mute Voz');
                punishmentDetails.push('• **Mute Voz**: Ativo');
            }

            // Verificar mute de chat
            const textRoleId = config.punishmentRoles?.mutedChat;
            if (textRoleId && target.roles.cache.has(textRoleId)) {
                activePunishments.push('💬 Mute Chat');
                punishmentDetails.push('• **Mute Chat**: Ativo');
            }

            // Verificar timeout
            if (target.isCommunicationDisabled()) {
                const timeoutEnd = target.communicationDisabledUntil;
                if (timeoutEnd) {
                    const remainingTime = Math.max(0, timeoutEnd.getTime() - Date.now());
                    if (remainingTime > 0) {
                        const remainingMinutes = Math.ceil(remainingTime / (1000 * 60));
                        activePunishments.push('⏰ Castigo (Timeout)');
                        punishmentDetails.push(`• **Castigo**: Expira <t:${Math.floor(timeoutEnd.getTime() / 1000)}:R>`);
                    }
                }
            }

            // Obter informações do usuário
            const userRank = getUserHighestRank(target);
            const joinedAt = target.joinedAt;
            const accountCreated = targetUser.createdAt;

            // Criar embed de resposta
            const embed = new EmbedBuilder()
                .setTitle('📊 Status de Punições')
                .setDescription(`Informações de punições para **${target.displayName}**`)
                .setThumbnail(targetUser.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuário', value: `<@${target.id}>\n\`${target.id}\``, inline: true },
                    { name: '🎖️ Patente', value: userRank.rankName, inline: true },
                    { name: '📅 Entrou no Servidor', value: joinedAt ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:D>` : 'Desconhecido', inline: true }
                )
                .setFooter({ text: 'Sistema de Punições - CDW' })
                .setTimestamp();

            if (activePunishments.length > 0) {
                embed.setColor(0xE74C3C);
                embed.addFields(
                    { name: '⚠️ Punições Ativas', value: punishmentDetails.join('\n'), inline: false },
                    { name: '📊 Total de Punições', value: `${activePunishments.length} ativa(s)`, inline: true }
                );
            } else {
                embed.setColor(0x2ECC71);
                embed.addFields(
                    { name: '✅ Status', value: 'Nenhuma punição ativa', inline: false }
                );
            }

            // Adicionar informações da conta
            embed.addFields(
                { name: '🗓️ Conta Criada', value: `<t:${Math.floor(accountCreated.getTime() / 1000)}:D>`, inline: true },
                { name: '🔍 Verificado por', value: `<@${executor.id}>`, inline: true }
            );

            await interaction.reply({
                embeds: [embed],
                ephemeral: true
            });

            // Log da verificação
            logger.info({ 
                targetId: target.id, 
                executorId: executor.id, 
                activePunishments: activePunishments.length,
                punishments: activePunishments
            }, 'Status de punição verificado');

        } catch (error) {
            logger.error({ error }, 'Erro no comando /status-punicao');
            
            const errorMessage = 'Ocorreu um erro ao verificar o status de punições.';
            
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
