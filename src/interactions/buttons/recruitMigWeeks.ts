import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, GuildMember, EmbedBuilder } from 'discord.js';
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

function getHierarchyRange(cfg: any, slot: '1'|'2'|'3'|'merit') {
  const order: string[] = cfg.hierarchyOrder || [];
  const fromTo: Record<string, [string, string]> = {
    '1': ['Aprendiz','1 Sargento'],
    '2': ['Sub Oficial','1 Tenente'],
    '3': ['Capitão','Coronel'],
    'merit': ['Sub Comandante','Manager']
  };
  const [from, to] = fromTo[slot];
  const i1 = order.indexOf(from);
  const i2 = order.indexOf(to);
  return (i1 >= 0 && i2 >= 0 && i2 >= i1) ? order.slice(i1, i2 + 1) : [];
}

export default {
  id: 'recruit_mig_weeks',
  async execute(interaction: ButtonInteraction) {
    await interaction.deferReply({ ephemeral: true });
    try {
      const cfg: any = loadConfig();
      const [_, slot, team, userId] = interaction.customId.split(':');
      const target = await interaction.guild?.members.fetch(userId).catch(() => null);
      if (!target) return interaction.editReply('Usuário não encontrado.');

      if (slot === 'merit') {
        if (!canSetMerit(interaction.member as GuildMember)) return interaction.editReply('Sem permissão para mérito.');
      } else {
        if (!canSetWeeks(interaction.member as GuildMember)) return interaction.editReply('Sem permissão para migração por semanas.');
      }

      const ranks = getHierarchyRange(cfg, slot as any);
      if (ranks.length === 0) return interaction.editReply('Faixa de cargos indisponível.');

      const rows: ActionRowBuilder<ButtonBuilder>[] = [];
      let row = new ActionRowBuilder<ButtonBuilder>();
      for (const rank of ranks) {
        const rid = cfg.roles?.[rank];
        if (!rid) continue;
        if (row.components.length === 5) { rows.push(row); row = new ActionRowBuilder<ButtonBuilder>(); }
        row.addComponents(new ButtonBuilder().setCustomId(`recruit_mig_rank:${rid}:${team}:${userId}`).setLabel(rank).setStyle(2));
      }
      if (row.components.length) rows.push(row);
      if (!rows.length) return interaction.editReply('Nenhum cargo configurado para essa faixa.');
      return interaction.editReply({ content: 'Selecione o cargo da hierarquia:', components: rows });
    } catch (e) {
      logger.warn({ e }, 'recruit_mig_weeks failed');
      return interaction.editReply('Erro ao carregar cargos.');
    }
  }
};
