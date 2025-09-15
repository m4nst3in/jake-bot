import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import { loadConfig, reloadConfig } from '../../config/index.ts';
import { RECRUIT_AREAS } from '../../commands/recrutar.ts';
import { BlacklistRepository } from '../../repositories/blacklistRepository.ts';
const MAIN_LOG_CHANNEL_ID = '1414539961515900979';
const TEAM_COLORS: Record<string, number> = {
    movcall: 0x1abc9c,
    design: 0xe67e22,
    jornalismo: 0xFFB6ED,
    recrutamento: 0x3498db,
    eventos: 0xf1c40f
};
export default {
    id: 'recruit_team',
    async execute(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true });
        const cfg: any = reloadConfig();
        const parts = interaction.customId.split(':');
        const team = parts[1].toLowerCase();
        const userId = parts[2];
        try {
            if ((interaction.component as any)?.disabled) {
                await interaction.editReply('Esta ação está bloqueada no momento.');
                return;
            }
        }
        catch { }
        if (!RECRUIT_AREAS.find(a => a.key === team)) {
            await interaction.editReply('Equipe inválida.');
            return;
        }
        const blRepo = new BlacklistRepository();
        let isGloballyBlacklisted = false;
        try {
            isGloballyBlacklisted = await blRepo.isBlacklisted(userId, 'GLOBAL');
        }
        catch { }
        if (isGloballyBlacklisted) {
            await interaction.editReply('Usuário está na Blacklist GLOBAL e não pode ser recrutado.');
            return;
        }
    const member = await interaction.guild?.members.fetch(userId).catch(() => null);
        if (!member) {
            await interaction.editReply('Usuário não encontrado no servidor.');
            return;
        }
    const areaCfg = (cfg.areas || []).find((a: any) => a.name.toLowerCase() === team);
    const primaryMap = cfg.primaryGuildTeamRoles || {};
    const primaryRoleId = primaryMap[team];
    if (!areaCfg && !primaryRoleId) {
            await interaction.editReply('Config da equipe não encontrada.');
            return;
        }
    // Não aplicar o cargo de equipe agora; somente após escolher Iniciante ou a hierarquia.
        // Disable original area selection buttons to prevent duplicate actions
        try {
            if (interaction.message.editable) {
                const rows = interaction.message.components.map((r: any) => {
                    const row = new ActionRowBuilder<ButtonBuilder>();
                    (r.components || []).forEach((c: any) => {
                        if (c?.data?.custom_id) {
                            const b = ButtonBuilder.from(c as any);
                            b.setDisabled(true);
                            row.addComponents(b);
                        }
                    });
                    return row;
                });
                await interaction.message.edit({ components: rows }).catch(() => { });
            }
        }
        catch { }

        // Apresentar próximo passo: Iniciante vs Migração (embed decorado)
        const color = TEAM_COLORS[team] || 0x3498db;
        const embed = new EmbedBuilder()
            .setTitle('Recrutamento • Seleção de Modo')
            .setColor(color)
            .setDescription([
                `Equipe selecionada: **${team.toUpperCase()}**`,
                `Candidato: <@${userId}>`,
                '',
                'Escolha como deseja prosseguir:',
                '• Iniciante — aplica o cargo Iniciante',
                '• Migração — seleciona cargo da hierarquia conforme o tempo',
                '• Equipe — aplica apenas o cargo da equipe + Staff'
            ].join('\n'))
            .setFooter({ text: `ID do usuário: ${userId}`, iconURL: interaction.guild?.iconURL() || undefined })
            .setTimestamp();
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`recruit_mode:inic:${team}:${userId}`).setLabel('Iniciante').setStyle(3),
            new ButtonBuilder().setCustomId(`recruit_mode:mig:${team}:${userId}`).setLabel('Migração').setStyle(1),
            new ButtonBuilder().setCustomId(`recruit_mode:team:${team}:${userId}`).setLabel('Equipe').setStyle(2)
        );
        await interaction.editReply({ embeds: [embed], components: [row] });

    // Não enviar logs aqui; apenas quando o recrutamento for concluído (embed final).
    }
};
