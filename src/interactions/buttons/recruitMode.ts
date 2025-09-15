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
        // Garantir Staff no servidor principal
        try {
          const mainGuildId: string | undefined = cfg.mainGuildId;
          if (staff && mainGuildId) {
            const mainGuild: any = interaction.client.guilds.cache.get(mainGuildId) || await interaction.client.guilds.fetch(mainGuildId).catch(() => null);
            const mainMember = mainGuild ? await mainGuild.members.fetch(userId).catch(() => null) : null;
            if (mainMember && !mainMember.roles.cache.has(staff)) {
              await mainMember.roles.add(staff, 'Recrutamento (Iniciante) • Staff global').catch(() => {});
              added.push(staff);
            }
          }
        } catch {}

        // Aplicar cargo de equipe agora (após finalização)
        try {
          const areaCfg = (cfg.areas || []).find((a: any) => a.name.toLowerCase() === team);
          const primaryMap = cfg.primaryGuildTeamRoles || {};
          const primaryRoleId = primaryMap[team as any];
          let teamRoleId = areaCfg?.roleIds?.member;
          if (interaction.guildId === cfg.mainGuildId && primaryRoleId) teamRoleId = primaryRoleId;
          if (teamRoleId && !String(teamRoleId).startsWith('ROLE_ID_') && !target.roles.cache.has(String(teamRoleId))) {
            await target.roles.add(String(teamRoleId), 'Recrutamento: cargo de equipe (após Iniciante)').catch(() => {});
          }
        } catch {}

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle('<a:asparkles:1118602923346243615> Recrutamento Efetuado')
          .addFields(
            { name: '<:branco_membros:1303749626062573610> Usuário', value: `<@${userId}>\n(${userId})`, inline: true },
            { name: '<:crown2:1411488673924644944> Staff', value: `<@${interaction.user.id}>\n(${interaction.user.id})`, inline: true },
            { name: '<a:staff_cdw:934664526639562872> Equipe', value: String(team || '').toUpperCase(), inline: true },
          )
          .addFields({
            name: '<:x_hype:1283509028995207241> Cargos Atribuídos',
            value: (() => {
              const primaryMap = (cfg as any).primaryGuildTeamRoles || {};
              const areaCfg = (cfg as any).areas?.find((a: any) => a.name.toLowerCase() === team);
              const teamRoleId = primaryMap[team as any] || areaCfg?.roleIds?.member;
              const r: string[] = [];
              if (teamRoleId) r.push(`<@&${teamRoleId}>`);
              if (inic) r.push(`<@&${inic}>`);
              if (cfg.roles?.staff) r.push(`<@&${cfg.roles.staff}>`);
              return r.join(' ')
            })()
          })
          .setTimestamp();
        // Send ephemeral confirmation
        await interaction.editReply({ embeds: [embed] });
        // Audit log to recruitment points/log channel (only final log)
        try {
          const logEmbed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('<a:asparkles:1118602923346243615> Recrutamento Efetuado')
            .addFields(
              { name: '<:branco_membros:1303749626062573610> Usuário', value: `<@${userId}>\n(${userId})`, inline: true },
              { name: '<:crown2:1411488673924644944> Staff', value: `<@${interaction.user.id}>\n(${interaction.user.id})`, inline: true },
              { name: '<a:staff_cdw:934664526639562872> Equipe', value: String(team || '').toUpperCase(), inline: true },
            )
            .addFields({
              name: '<:x_hype:1283509028995207241> Cargos Atribuídos',
              value: (() => {
                const primaryMap = (cfg as any).primaryGuildTeamRoles || {};
                const areaCfg = (cfg as any).areas?.find((a: any) => a.name.toLowerCase() === team);
                const teamRoleId = primaryMap[team as any] || areaCfg?.roleIds?.member;
                const r: string[] = [];
                if (teamRoleId) r.push(`<@&${teamRoleId}>`);
                if (inic) r.push(`<@&${inic}>`);
                if ((cfg as any).roles?.staff) r.push(`<@&${(cfg as any).roles.staff}>`);
                return r.join(' ');
              })()
            })
            .setTimestamp();
          const MAIN_LOG_CHANNEL = '1414539961515900979';
          const mainCh: any = await interaction.client.channels.fetch(MAIN_LOG_CHANNEL).catch(() => null);
          if (mainCh && mainCh.isTextBased()) await mainCh.send({ embeds: [logEmbed] }).catch(() => {});
        } catch {}
        return;
      }

      if (mode === 'team') {
        // Same permissions as Iniciante
        if (!canSetIniciante(interaction.member as GuildMember)) return interaction.editReply('Sem permissão para definir cargo de equipe.');
        const added: string[] = [];
        try {
          // Determine team role to add (prefer primary on main guild)
          const areaCfg = (cfg.areas || []).find((a: any) => a.name.toLowerCase() === team);
          const primaryMap = cfg.primaryGuildTeamRoles || {};
          const primaryRoleId = primaryMap[team as any];
          let teamRoleId = areaCfg?.roleIds?.member;
          if (interaction.guildId === cfg.mainGuildId && primaryRoleId) teamRoleId = primaryRoleId;
          if (!teamRoleId) return interaction.editReply('Cargo de equipe não configurado.');
          if (!target.roles.cache.has(String(teamRoleId))) {
            await target.roles.add(String(teamRoleId), 'Recrutamento: cargo de equipe').catch(() => {});
            added.push(String(teamRoleId));
          }
        } catch {}

        // Ensure Staff on main guild
        try {
          const staff = cfg.roles?.staff;
          const mainGuildId: string | undefined = cfg.mainGuildId;
          if (staff && mainGuildId) {
            const mainGuild: any = interaction.client.guilds.cache.get(mainGuildId) || await interaction.client.guilds.fetch(mainGuildId).catch(() => null);
            const mainMember = mainGuild ? await mainGuild.members.fetch(userId).catch(() => null) : null;
            if (mainMember && !mainMember.roles.cache.has(staff)) {
              await mainMember.roles.add(staff, 'Recrutamento (Equipe) • Staff global').catch(() => {});
              added.push(staff);
            }
          }
        } catch {}

        // Build confirmation + log embed in old style
        const buildEmbed = (cfg: any) => {
          const primaryMap = (cfg as any).primaryGuildTeamRoles || {};
          const areaCfg = (cfg as any).areas?.find((a: any) => a.name.toLowerCase() === team);
          const teamRoleId = primaryMap[team as any] || areaCfg?.roleIds?.member;
          const rolesLine = [teamRoleId && `<@&${teamRoleId}>`, (cfg as any).roles?.staff && `<@&${(cfg as any).roles.staff}>`].filter(Boolean).join(' ');
          return new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('<a:asparkles:1118602923346243615> Recrutamento Efetuado')
            .addFields(
              { name: '<:branco_membros:1303749626062573610> Usuário', value: `<@${userId}>\n(${userId})`, inline: true },
              { name: '<:crown2:1411488673924644944> Staff', value: `<@${interaction.user.id}>\n(${interaction.user.id})`, inline: true },
              { name: '<a:staff_cdw:934664526639562872> Equipe', value: String(team || '').toUpperCase(), inline: true }
            )
            .addFields({ name: '<:x_hype:1283509028995207241> Cargos Atribuídos', value: rolesLine || '—' })
            .setTimestamp();
        };

        const ephem = buildEmbed(cfg);
        await interaction.editReply({ embeds: [ephem] });
        try {
          const logEmbed = buildEmbed(cfg);
          const MAIN_LOG_CHANNEL = '1414539961515900979';
          const mainCh: any = await interaction.client.channels.fetch(MAIN_LOG_CHANNEL).catch(() => null);
          if (mainCh && mainCh.isTextBased()) await mainCh.send({ embeds: [logEmbed] }).catch(() => {});
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
        const color = 0x3498db;
        const embed = new EmbedBuilder()
          .setTitle('Recrutamento • Migração')
          .setColor(color)
          .setDescription('Selecione o tipo de migração:')
          .setFooter({ text: `Usuário: ${userId}`, iconURL: interaction.guild?.iconURL() || undefined })
          .setTimestamp();
        return interaction.editReply({ embeds: [embed], components: [row] });
      }

      return interaction.editReply('Modo inválido.');
    } catch (e) {
      logger.warn({ e }, 'recruit_mode failed');
      return interaction.editReply('Erro ao processar modo.');
    }
  }
};
