import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, GuildMember, EmbedBuilder } from 'discord.js';
import { loadConfig } from '../../config/index.ts';
import { logger } from '../../utils/logger.ts';

function hasRole(member: GuildMember | null | undefined, id?: string) {
  return !!(member && id && member.roles.cache.has(id));
}

function isOwner(userId: string): boolean {
  const cfg: any = loadConfig();
  return Array.isArray(cfg.owners) && cfg.owners.includes(userId);
}

function canSetIniciante(member: GuildMember | null | undefined): boolean {
  const cfg: any = loadConfig();
  const recruitTeamRole = cfg.primaryGuildTeamRoles?.recrutamento;
  const recruitLeadRole = cfg.primaryGuildLeadershipRoles?.recrutamento;
  const fullAccessRoleId: string | undefined = cfg.fullAccessRoleId;
  return isOwner(member?.id || '') || hasRole(member, fullAccessRoleId) || hasRole(member, recruitTeamRole) || hasRole(member, recruitLeadRole);
}

function canSetWeeks(member: GuildMember | null | undefined): boolean {
  const cfg: any = loadConfig();
  const migGlobalRole = cfg.protectionRoles?.migGlobal; // equipe de migração
  const migTeamRole = cfg.primaryGuildTeamRoles?.mig;
  const recruitLeadRole = cfg.primaryGuildLeadershipRoles?.recrutamento;
  const fullAccessRoleId: string | undefined = cfg.fullAccessRoleId;
  return isOwner(member?.id || '') || hasRole(member, fullAccessRoleId) || hasRole(member, migGlobalRole) || hasRole(member, migTeamRole) || hasRole(member, recruitLeadRole);
}

function canSetMerit(member: GuildMember | null | undefined): boolean {
  const cfg: any = loadConfig();
  const recruitLeadRole = cfg.primaryGuildLeadershipRoles?.recrutamento;
  const fullAccessRoleId: string | undefined = cfg.fullAccessRoleId;
  return isOwner(member?.id || '') || hasRole(member, fullAccessRoleId) || hasRole(member, recruitLeadRole);
}

export default {
  id: 'recruit_mode',
  async execute(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const cfg: any = loadConfig();
      const [_, mode, team, userId] = interaction.customId.split(':');
  const target = await interaction.guild?.members.fetch(userId).catch(() => null);
  if (!target) return interaction.editReply('Usuário não encontrado.');

      if (mode === 'inic') {
        if (!canSetIniciante(interaction.member as GuildMember)) return interaction.editReply('Sem permissão para definir Iniciante.');
        const inic = cfg.roles?.Iniciante;
        const staff = cfg.roles?.staff;
        const added: string[] = [];
        // Remove other hierarchy roles (keep staff)
        const keepRoleNames = new Set(['staff']);
        for (const [name, id] of Object.entries(cfg.roles || {})) {
          if (!id) continue;
          if (keepRoleNames.has(name)) continue;
          if (target.roles.cache.has(String(id))) {
            try { await target.roles.remove(String(id), 'Recrutamento: resetando hierarquia para Iniciante'); } catch {}
          }
        }
        if (inic && !target.roles.cache.has(inic)) { await target.roles.add(inic, 'Recrutamento (Iniciante)').catch(() => {}); added.push(inic); }
        if (staff && !target.roles.cache.has(staff)) { await target.roles.add(staff, 'Recrutamento (Iniciante)').catch(() => {}); added.push(staff); }
        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('Recrutamento • Iniciante')
          .setDescription(`Definido Iniciante para <@${userId}>. Cargos: ${added.map(id => `<@&${id}>`).join(' ') || '—'}`)
          .setTimestamp();
        // Send ephemeral confirmation
        await interaction.editReply({ embeds: [embed] });
        // Audit log to recruitment points/log channel
        try {
          const logChannelId = cfg.recruitBanca?.pointsLogChannelId || cfg.channels?.recruitPointsLog || cfg.channels?.recruitRanking;
          if (logChannelId) {
            const ch: any = await interaction.client.channels.fetch(logChannelId).catch(() => null);
            if (ch && ch.isTextBased()) {
              const logEmbed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('Recrutamento • Iniciante aplicado')
                .setDescription([
                  `Usuário: <@${userId}> (${userId})`,
                  `Moderador: <@${interaction.user.id}> (${interaction.user.id})`,
                  `Equipe: ${String(team || '').toUpperCase() || '—'}`,
                  `Cargos aplicados: ${added.map(id => `<@&${id}>`).join(' ') || '—'}`
                ].join('\n'))
                .setTimestamp();
              await ch.send({ embeds: [logEmbed] }).catch(() => {});
            }
          }
        } catch {}
        return;
      }

      if (mode === 'mig') {
        if (!canSetWeeks(interaction.member as GuildMember)) return interaction.editReply('Sem permissão para migração.');
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`recruit_mig_weeks:1:${team}:${userId}`).setLabel('1 Semana').setStyle(1),
          new ButtonBuilder().setCustomId(`recruit_mig_weeks:2:${team}:${userId}`).setLabel('2 Semanas').setStyle(1),
          new ButtonBuilder().setCustomId(`recruit_mig_weeks:3:${team}:${userId}`).setLabel('3 Semanas').setStyle(1),
          new ButtonBuilder().setCustomId(`recruit_mig_weeks:merit:${team}:${userId}`).setLabel('Mérito').setStyle(4)
        );
        return interaction.editReply({ content: 'Selecione o tipo de migração:', components: [row] });
      }

      return interaction.editReply('Modo inválido.');
    } catch (e) {
      logger.warn({ e }, 'recruit_mode failed');
      return interaction.editReply('Erro ao processar modo.');
    }
  }
};
