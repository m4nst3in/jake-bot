import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { PointsService } from '../services/pointsService.ts';
import { PointRepository } from '../repositories/pointRepository.ts';
import { loadConfig } from '../config/index.ts';
import { BlacklistRepository } from '../repositories/blacklistRepository.ts';
import { OccurrenceRepository } from '../repositories/occurrenceRepository.ts';
import { getMemberLeaderAreas, hasCrossGuildLeadership } from '../utils/permissions.ts';

// /perfil [user]
export default {
  data: new SlashCommandBuilder()
    .setName('perfil')
    .setDescription('Mostra o perfil de pontos de um usuário')
    .addUserOption(o => o.setName('user').setDescription('Usuário alvo').setRequired(false)),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getUser('user') || interaction.user;
  const svc = new PointsService();
  const repo = new PointRepository();
  const blacklistRepo = new BlacklistRepository();
  const occRepo = new OccurrenceRepository();
    const cfg: any = loadConfig();
    const profile = await svc.getUserProfile(target.id);

    // Fetch positions, blacklist and occurrences in parallel
    const positionsPromise = Promise.all(profile.areas.map(a => (repo as any).getAreaPosition(target.id, a.area).catch(() => null)));
    // active blacklists
    const activeBlacklistPromise = blacklistRepo.listUserActive(target.id).catch(() => []);
    const occCountPromise = occRepo.countForUser(target.id).catch(() => 0);

    const [positions, activeBlacklist, occCount] = await Promise.all([positionsPromise, activeBlacklistPromise, occCountPromise]);
    const withPos = profile.areas.map((a, i) => ({ ...a, pos: positions[i] }));

    // Leadership detection across all configured guilds
    let leaderAreas: string[] = [];
    try {
      const cfgAreas: any[] = cfg.areas || [];
      const client = interaction.client;
      for (const a of cfgAreas) {
        if (!a.guildId || !a.roleIds?.lead) continue;
        try {
          const g = client.guilds.cache.get(a.guildId) || await client.guilds.fetch(a.guildId);
          const m = await g.members.fetch(target.id).catch(() => null);
          if (m && m.roles.cache.has(a.roleIds.lead)) {
            leaderAreas.push(a.name);
          }
        } catch {}
      }
    } catch {}
    leaderAreas = [...new Set(leaderAreas)].sort((a,b)=>a.localeCompare(b));

    const blacklistBadges = activeBlacklist.length ? activeBlacklist.map((b: any) => b.area_or_global || 'GLOBAL').join(', ') : '';

    const descLines: string[] = [];
    if (withPos.length) {
      for (const a of withPos) {
        const isRecruit = a.area.toLowerCase() === 'recrutamento';
        const isSupport = a.area.toLowerCase() === 'suporte';
        const extra: string[] = [];
        if (isRecruit || isSupport) {
          if (a.reports) extra.push(`🧾 ${a.reports} rel.`);
          if (a.shifts) extra.push(`🕒 ${a.shifts} plant.`);
        } else {
          if (a.reports) extra.push(`🧾 ${a.reports}`);
          if (a.shifts) extra.push(`🕒 ${a.shifts}`);
        }
        const posTxt = a.pos ? `#${a.pos}` : '#?';
        descLines.push(`• **${a.area}** ${posTxt} — **${a.points}** pts${extra.length ? ' • ' + extra.join(' • ') : ''}`);
      }
    } else {
      descLines.push('Sem registros de pontos.');
    }

    // Header badges
    const headerBadges: string[] = [];
    if (leaderAreas.length) headerBadges.push(`👑 Liderança: ${leaderAreas.join(', ')}`);
    if (blacklistBadges) headerBadges.push(`⛔ Blacklist: ${blacklistBadges}`);
    if (occCount) headerBadges.push(`📂 Ocorrências: ${occCount}`);

    const header = headerBadges.length ? headerBadges.join(' • ') : 'Nenhuma restrição ou liderança registrada.';
    const desc = `${header}\n\n${descLines.join('\n')}`;

    const embed = new EmbedBuilder()
      .setTitle(`Perfil de ${target.username || target.tag || target.id}`)
      .setDescription(desc)
      .setFooter({ text: `Total: ${profile.total} pts • ID: ${target.id}` })
      .setTimestamp();

    // Aplicar cor por guild se possível
    try {
      if (interaction.guildId) {
        const areas = (cfg.areas || []);
        const guildArea = areas.find((a: any) => a.guildId === interaction.guildId);
        if (guildArea) {
          const name = guildArea.name.toUpperCase();
          const colorMap: Record<string, number> = {
            'SUPORTE': 0xFFFFFF,
            'DESIGN': 0xE67E22,
            'JORNALISMO': 0xFFB6ED,
            'MOVCALL': 0x8B0000,
            'RECRUTAMENTO': 0x39ff14
          };
          if (colorMap[name]) embed.setColor(colorMap[name]);
        } else {
          embed.setColor(0x5865F2);
        }
      }
    } catch { embed.setColor(0x5865F2); }

    await interaction.editReply({ embeds: [embed] });
  }
};
