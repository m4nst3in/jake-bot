import { ButtonInteraction, GuildMember, EmbedBuilder } from 'discord.js';
import { loadConfig } from '../../config/index.ts';
import { logger } from '../../utils/logger.ts';

function hasRole(member: GuildMember | null | undefined, id?: string) { return !!(member && id && member.roles.cache.has(id)); }
function isOwner(userId: string): boolean { const cfg: any = loadConfig(); return Array.isArray(cfg.owners) && cfg.owners.includes(userId); }
function canSetWeeks(member: GuildMember | null | undefined): boolean {
  const cfg: any = loadConfig();
  const migGlobalRole = cfg.protectionRoles?.migGlobal;
  const recruitLeadRole = cfg.primaryGuildLeadershipRoles?.recrutamento;
  const fullAccessRoleId: string | undefined = cfg.fullAccessRoleId;
  return isOwner(member?.id || '') || hasRole(member, fullAccessRoleId) || hasRole(member, migGlobalRole) || hasRole(member, recruitLeadRole);
}
function canSetMerit(member: GuildMember | null | undefined): boolean {
  const cfg: any = loadConfig();
  const recruitLeadRole = cfg.primaryGuildLeadershipRoles?.recrutamento;
  const fullAccessRoleId: string | undefined = cfg.fullAccessRoleId;
  return isOwner(member?.id || '') || hasRole(member, fullAccessRoleId) || hasRole(member, recruitLeadRole);
}

export default {
  id: 'recruit_mig_rank',
  async execute(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const cfg: any = loadConfig();
      const [_, roleId, team, userId] = interaction.customId.split(':');
      const member = interaction.member as GuildMember | null;
      const target = await interaction.guild?.members.fetch(userId).catch(() => null);
      if (!target) return interaction.editReply('Usuário não encontrado.');

      // Permission check: if the rank is merit tier (>= Sub Comandante), require canSetMerit; otherwise canSetWeeks
      const roleName = Object.keys(cfg.roles || {}).find(k => String(cfg.roles[k]) === roleId) || '';
      const meritStart = 'Sub Comandante';
      const meritIndex = (cfg.hierarchyOrder || []).indexOf(meritStart);
      const roleIndex = (cfg.hierarchyOrder || []).indexOf(roleName);
      const requireMerit = meritIndex >= 0 && roleIndex >= meritIndex;
      if (requireMerit) { if (!canSetMerit(member)) return interaction.editReply('Sem permissão para mérito.'); }
      else { if (!canSetWeeks(member)) return interaction.editReply('Sem permissão para migração por semanas.'); }

      // Remove any existing hierarchy role (keep staff) and set the selected role
      const keepRoleNames = new Set(['staff']);
      for (const [name, id] of Object.entries(cfg.roles || {})) {
        if (!id) continue;
        if (keepRoleNames.has(name)) continue;
        if (target.roles.cache.has(String(id))) {
          try { await target.roles.remove(String(id), 'Migração: substituição de hierarquia'); } catch {}
        }
      }
      await target.roles.add(roleId, 'Migração: aplicação de hierarquia').catch(() => {});

      // Garantir Staff no main guild
      try {
        const staff = cfg.roles?.staff;
        const mainGuildId: string | undefined = cfg.mainGuildId;
        if (staff && mainGuildId) {
          const mainGuild: any = interaction.client.guilds.cache.get(mainGuildId) || await interaction.client.guilds.fetch(mainGuildId).catch(() => null);
          const mainMember = mainGuild ? await mainGuild.members.fetch(userId).catch(() => null) : null;
          if (mainMember && !mainMember.roles.cache.has(staff)) {
            await mainMember.roles.add(staff, 'Migração • Staff global').catch(() => {});
          }
        }
      } catch {}

      // Aplicar cargo de equipe somente agora
      try {
        const areaCfg = (cfg.areas || []).find((a: any) => a.name.toLowerCase() === team);
        const primaryMap = cfg.primaryGuildTeamRoles || {};
        const primaryRoleId = primaryMap[team as any];
        let teamRoleId = areaCfg?.roleIds?.member;
        if (interaction.guildId === cfg.mainGuildId && primaryRoleId) teamRoleId = primaryRoleId;
        if (teamRoleId && !String(teamRoleId).startsWith('ROLE_ID_') && !target.roles.cache.has(String(teamRoleId))) {
          await target.roles.add(String(teamRoleId), 'Recrutamento: cargo de equipe (após Migração)').catch(() => {});
        }
      } catch {}

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('Recrutamento • Migração')
        .setDescription(`Definido cargo **${roleName || roleId}** para <@${userId}>.`)
        .setTimestamp();
      // Ephemeral confirmation
      await interaction.editReply({ embeds: [embed], components: [] });
      // Audit log to recruitment log/points channel
      try {
        const logEmbed = new EmbedBuilder()
          .setColor(0x3498db)
          .setTitle('Recrutamento • Migração aplicada')
          .setDescription([
            `Usuário: <@${userId}> (${userId})`,
            `Moderador: <@${interaction.user.id}> (${interaction.user.id})`,
            `Equipe: ${String(team || '').toUpperCase() || '—'}`,
            `Cargo: ${roleName || roleId}`
          ].join('\n'))
          .setTimestamp();
        const MAIN_LOG_CHANNEL = '1414539961515900979';
        const mainCh: any = await interaction.client.channels.fetch(MAIN_LOG_CHANNEL).catch(() => null);
        if (mainCh && mainCh.isTextBased()) await mainCh.send({ embeds: [logEmbed] }).catch(() => {});
      } catch {}
      return;
    } catch (e) {
      logger.warn({ e }, 'recruit_mig_rank failed');
      return interaction.editReply('Erro ao aplicar cargo.');
    }
  }
};
