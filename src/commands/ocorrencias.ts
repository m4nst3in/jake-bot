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
  .addStringOption(o => o.setName('resolucao').setDescription('Resolução / ação tomada').setRequired(true))
  .addAttachmentOption(o => o.setName('prova').setDescription('Imagem de prova (obrigatória)').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
  const member = interaction.member as GuildMember | null;
  const staffId = interaction.options.getString('id', true).trim();
  const motivo = interaction.options.getString('motivo', true).trim();
  const resolucao = interaction.options.getString('resolucao', true).trim();
  const prova = interaction.options.getAttachment('prova', true);

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

    // Validar prova (imagem)
    if (!prova || !(prova.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(prova.name))) {
      await interaction.editReply('A prova deve ser uma imagem (png/jpg/gif/webp).');
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
    lines.push(`<:cdw_ponto_branco:1108388917004226601> **Responsável:** <@${interaction.user.id}> (${interaction.user.id})`);
    lines.push(`<:cdw_ponto_branco:1108388917004226601> **Staff Acusado:** <@${staffId}> (${staffId})`);
    lines.push(`<:cdw_ponto_branco:1108388917004226601> **Motivo:** ${motivo}`);
    lines.push(`<:cdw_ponto_branco:1108388917004226601> **Resolução:** ${resolucao}`);
  lines.push(`<:cdw_ponto_branco:1108388917004226601> **Prova:** ${prova.url}`);

    const embed = new EmbedBuilder()
      .setTitle('<a:staff_cdw:934664526639562872> Ocorrência de Staff')
      .setDescription(lines.join('\n'))
      .setColor(color)
      .setFooter({ text: 'Sistema de Ocorrências • Registro permanente' })
  .setTimestamp()
  .setImage(prova.url);

    const repo = new OccurrenceRepository();
  // Coletar menções de liderança: apenas das áreas cujos cargos de equipe o staff alvo possui.
  // Agora usando mapa global primaryGuildLeadershipRoles do servidor principal.
    let leadershipRoleMentions: string[] = [];
    try {
      const cfgAny: any = cfg;
      const mainGuildId: string | undefined = cfgAny.mainGuildId;
  const primaryTeamRoles: Record<string,string> = cfgAny.primaryGuildTeamRoles || {};
  const primaryLeadershipRoles: Record<string,string> = cfgAny.primaryGuildLeadershipRoles || {};
      if (mainGuildId) {
        const mainGuild = interaction.client.guilds.cache.get(mainGuildId) || await interaction.client.guilds.fetch(mainGuildId);
        const targetMemberMain = await mainGuild.members.fetch(staffId).catch(()=>null);
        if (targetMemberMain) {
          const collected = new Set<string>();
          for (const [key, teamRoleId] of Object.entries(primaryTeamRoles)) {
            if (!teamRoleId) continue;
            if (!targetMemberMain.roles.cache.has(teamRoleId)) continue; // usuário não tem cargo de equipe dessa área
            // Usar cargo de liderança global correspondente
            const leadRoleId = primaryLeadershipRoles[key.toLowerCase()];
            if (leadRoleId) collected.add(leadRoleId);
          }
          leadershipRoleMentions = [...collected].map(r=>`<@&${r}>`);
        }
      }
    } catch {
      // Silencioso: falha em resolução de liderança não deve impedir registro da ocorrência
    }

    try {
      const sent = await channel.send({ content: leadershipRoleMentions.length ? `${leadershipRoleMentions.join(' ')}` : undefined, embeds: [embed] });
      await repo.add({ staff_id: staffId, motivo1: motivo, resolucao, created_by: interaction.user.id });
      // Reagir com o emoji customizado
      try { await sent.react('white_certocr:1293360415857836072'); } catch {}
      await interaction.editReply('Ocorrência registrada com sucesso.');
    } catch (e) {
      await interaction.editReply('Falha ao enviar a ocorrência.');
    }
  }
};