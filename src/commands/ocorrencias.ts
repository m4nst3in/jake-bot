import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { hasAnyLeadership, isAdminFromMember, isOwner, hasCrossGuildLeadership } from '../utils/permissions.ts';
import { loadConfig } from '../config/index.ts';
import { OccurrenceRepository } from '../repositories/occurrenceRepository.ts';

// Canal fixo principal para ocorrências
const OCORRENCIAS_CHANNEL_ID = '1373853106172854332';

export default {
  data: new SlashCommandBuilder()
    .setName('ocorrencias')
    .setDescription('Registra uma ocorrência de staff')
    // Ordem solicitada: (id) (motivo) (resolução)
    .addStringOption(o => o.setName('id').setDescription('ID do staff acusado').setRequired(true))
    .addStringOption(o => o.setName('motivo').setDescription('Motivo principal / título').setRequired(true))
    .addStringOption(o => o.setName('resolucao').setDescription('Resolução / ação tomada').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
  const member = interaction.member as GuildMember | null;
  const staffId = interaction.options.getString('id', true).trim();
  const motivo = interaction.options.getString('motivo', true).trim();
  const resolucao = interaction.options.getString('resolucao', true).trim();

    // Permissões: lideranças, líder geral (admin) ou donos
    let hasLeadership = hasAnyLeadership(member || null);
    if (!hasLeadership && member) {
      hasLeadership = await hasCrossGuildLeadership(interaction.client, member.id);
    }
    const allowed = isOwner(member) || isAdminFromMember(member) || hasLeadership;
    if (!allowed) {
      await interaction.editReply('Você não possui permissão para usar este comando.');
      return;
    }

    if (!/^[0-9]{5,20}$/.test(staffId)) {
      await interaction.editReply('ID inválido.');
      return;
    }

    // Validar se é staff (precisa ter cargo staff global no mainGuild)
    try {
      const cfgAny: any = loadConfig();
      const mainGuildId = cfgAny.mainGuildId;
      const staffRole = cfgAny.roles?.staff;
      if (mainGuildId && staffRole) {
        const g = interaction.client.guilds.cache.get(mainGuildId) || await interaction.client.guilds.fetch(mainGuildId);
        const targetMember = await g.members.fetch(staffId).catch(()=>null);
        if (!targetMember || !targetMember.roles.cache.has(staffRole)) {
          await interaction.editReply('O alvo não possui cargo de staff.');
          return;
        }
      } else {
        // Se não houver configuração clara, ainda assim continuamos, mas registramos aviso
      }
    } catch {
      await interaction.editReply('Falha ao validar staff.');
      return;
    }

    const channel = await interaction.client.channels.fetch(OCORRENCIAS_CHANNEL_ID).catch(() => null) as any;
    if (!channel || !channel.isTextBased()) {
      await interaction.editReply('Canal de ocorrências indisponível.');
      return;
    }

    const cfg: any = loadConfig();
    const color = 0xE74C3C; // vermelho padrão para alertas
    const lines: string[] = [];
    lines.push(`<:branco_membros:1303749626062573610> **Staff Acusado:** <@${staffId}> (${staffId})`);
    lines.push(`<a:staff_cdw:934664526639562872> **Acionante:** <@${interaction.user.id}> (${interaction.user.id})`);
  lines.push(`<:p_bow02:1312933529100750858> **Motivo:** ${motivo}`);
    lines.push(`<a:emoji_50:1330028935563575306> **Resolução:** ${resolucao}`);
    lines.push(`🕒 **Data:** <t:${Math.floor(Date.now()/1000)}:F>`);

    const embed = new EmbedBuilder()
      .setTitle('📂 Ocorrência de Staff')
      .setDescription(lines.join('\n'))
      .setColor(color)
      .setFooter({ text: 'Sistema de Ocorrências • Registro permanente' })
      .setTimestamp();

    const repo = new OccurrenceRepository();
  // Coletar menções de liderança das áreas onde o staff participa
    let leadershipRoleMentions: string[] = [];
    try {
      const cfgAny: any = cfg;
      const areas: any[] = cfgAny.areas || [];
      const rolesSet = new Set<string>();
      await Promise.all(areas.map(async (a: any) => {
        if (!a.guildId || !a.roleIds?.lead) return;
        try {
          const g = interaction.client.guilds.cache.get(a.guildId) || await interaction.client.guilds.fetch(a.guildId);
          const m = await g.members.fetch(staffId).catch(() => null);
          if (m) {
            rolesSet.add(a.roleIds.lead);
          }
        } catch {}
      }));
      leadershipRoleMentions = [...rolesSet].map(r => `<@&${r}>`);
    } catch {}

    try {
      const sent = await channel.send({ content: leadershipRoleMentions.length ? `Alerta ${leadershipRoleMentions.join(' ')}` : undefined, embeds: [embed] });
      await repo.add({ staff_id: staffId, motivo1: motivo, resolucao, created_by: interaction.user.id });
      // Reagir com o emoji customizado
      try { await sent.react('white_certocr:1293360415857836072'); } catch {}
      await interaction.editReply('Ocorrência registrada com sucesso.');
    } catch (e) {
      await interaction.editReply('Falha ao enviar a ocorrência.');
    }
  }
};