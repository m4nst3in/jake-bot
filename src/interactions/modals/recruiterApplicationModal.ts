import { ModalSubmitInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { loadConfig } from '../../config/index.ts';

export default {
    id: 'recruiter_application_modal',
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });

        const age = interaction.fields.getTextInputValue('age').trim();
        const reason = interaction.fields.getTextInputValue('reason').trim();
        const availableTime = interaction.fields.getTextInputValue('available_time').trim();
        const experience = interaction.fields.getTextInputValue('experience').trim();

        // Validar idade
        const ageNum = parseInt(age, 10);
        if (isNaN(ageNum) || ageNum < 13 || ageNum > 99) {
            await interaction.editReply('❌ Por favor, insira uma idade válida entre 13 e 99 anos.');
            return;
        }

        const cfg: any = loadConfig();
        const recruitmentGuildId = '1180721287476289596';
        const applicationChannelId = '1417433748663701505';

        try {
            // Buscar guild de recrutamento
            const recruitmentGuild = await interaction.client.guilds.fetch(recruitmentGuildId).catch(() => null);
            if (!recruitmentGuild) {
                await interaction.editReply('❌ Erro interno: Servidor de recrutamento não encontrado.');
                return;
            }

            // Buscar canal de candidaturas
            const applicationChannel = await recruitmentGuild.channels.fetch(applicationChannelId).catch(() => null);
            if (!applicationChannel || !applicationChannel.isTextBased()) {
                await interaction.editReply('❌ Erro interno: Canal de candidaturas não encontrado.');
                return;
            }

            // Obter informações do candidato
            const candidate = interaction.user;
            const mainGuildId = cfg.mainGuildId;
            
            // Buscar membro no servidor principal
            const mainGuild = await interaction.client.guilds.fetch(mainGuildId).catch(() => null);
            let mainMember: GuildMember | null = null;
            let hierarchyRole = 'Não identificado';
            let currentAreas: string[] = [];

            if (mainGuild) {
                mainMember = await mainGuild.members.fetch(candidate.id).catch(() => null);
                
                if (mainMember) {
                    // Identificar cargo de hierarquia
                    const roles = cfg.roles || {};
                    const hierarchyOrder = cfg.hierarchyOrder || [];
                    
                    for (const rankName of hierarchyOrder.reverse()) {
                        const roleId = roles[rankName];
                        if (roleId && mainMember.roles.cache.has(String(roleId))) {
                            hierarchyRole = rankName;
                            break;
                        }
                    }

                    // Identificar áreas atuais
                    const mainAreaRoleMap = cfg.mainAreaRoleMap || {};
                    for (const [roleId, areaName] of Object.entries(mainAreaRoleMap)) {
                        if (mainMember.roles.cache.has(roleId)) {
                            currentAreas.push(String(areaName));
                        }
                    }
                }
            }

            // Criar embed detalhada
            const applicationEmbed = new EmbedBuilder()
                .setTitle('<a:green_hypecuty_cdw:1415591722200731688> Nova Candidatura - Recrutador')
                .setDescription('**Uma nova candidatura para a equipe de Recrutamento foi recebida!**')
                .setColor(0x00FF94)
                .setThumbnail(candidate.displayAvatarURL())
                .addFields(
                    {
                        name: '<a:setabranca:1417092970380791850> **Informações do Candidato**',
                        value: `**Nome:** ${candidate.displayName}\n**ID:** \`${candidate.id}\`\n**Conta criada:** <t:${Math.floor(candidate.createdTimestamp / 1000)}:R>`,
                        inline: false
                    },
                    {
                        name: '<a:setabranca:1417092970380791850> **Hierarquia Atual**',
                        value: hierarchyRole,
                        inline: true
                    },
                    {
                        name: '<a:setabranca:1417092970380791850> **Áreas Atuais**',
                        value: currentAreas.length > 0 ? currentAreas.join(', ') : 'Nenhuma área identificada',
                        inline: true
                    },
                    {
                        name: '<a:setabranca:1417092970380791850> **Idade**',
                        value: `${age} anos`,
                        inline: true
                    },
                    {
                        name: '<a:setabranca:1417092970380791850> **Motivo para entrar no Recrutamento**',
                        value: reason,
                        inline: false
                    },
                    {
                        name: '<a:setabranca:1417092970380791850> **Tempo Disponível**',
                        value: availableTime,
                        inline: false
                    },
                    {
                        name: '<a:setabranca:1417092970380791850> **Experiências**',
                        value: experience,
                        inline: false
                    },
                    {
                        name: '<a:setabranca:1417092970380791850> **Data da Candidatura**',
                        value: `<t:${Math.floor(Date.now() / 1000)}:F>`,
                        inline: false
                    }
                )
                .setFooter({ 
                    text: 'Sistema de Candidaturas - Recrutamento CDW', 
                    iconURL: recruitmentGuild.iconURL() || undefined 
                })
                .setTimestamp();

            // Enviar candidatura
            await applicationChannel.send({ 
                content: `<@&1182824023344812154> Nova candidatura recebida!`,
                embeds: [applicationEmbed] 
            });

            await interaction.editReply('✅ **Candidatura enviada com sucesso!**\n\nSua candidatura foi encaminhada para a liderança de Recrutamento. Aguarde o contato da equipe.');

        } catch (error) {
            console.error('Erro ao processar candidatura de recrutador:', error);
            await interaction.editReply('❌ Ocorreu um erro ao enviar sua candidatura. Tente novamente mais tarde.');
        }
    }
};
