import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { hasAnyLeadership, isAdminFromMember, isOwner, hasCrossGuildLeadership } from '../utils/permissions.ts';
import { loadConfig } from '../config/index.ts';

// Canal fixo principal para ocorrências
const OCORRENCIAS_CHANNEL_ID = '1373853106172854332';

export default {
  data: new SlashCommandBuilder()
    .setName('ocorrencias')
    .setDescription('Registra uma ocorrência de staff')
    .addStringOption(o => o.setName('staff_id').setDescription('ID do staff acusado').setRequired(true))
    .addStringOption(o => o.setName('motivo1').setDescription('Motivo principal / título').setRequired(true))
    .addStringOption(o => o.setName('motivo2').setDescription('Detalhamento adicional (opcional)').setRequired(false))
    .addStringOption(o => o.setName('resolucao').setDescription('Resolução / ação tomada').setRequired(true)),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const member = interaction.member as GuildMember | null;
    const staffId = interaction.options.getString('staff_id', true).trim();
    const motivo1 = interaction.options.getString('motivo1', true).trim();
    const motivo2 = interaction.options.getString('motivo2')?.trim();
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
      await interaction.editReply('ID de usuário inválido.');
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
    lines.push(`<:p_bow02:1312933529100750858> **Motivo:** ${motivo1}`);
    if (motivo2) lines.push(`<:p_bow02:1312933529100750858> **Detalhes:** ${motivo2}`);
    lines.push(`<a:emoji_50:1330028935563575306> **Resolução:** ${resolucao}`);
    lines.push(`🕒 **Data:** <t:${Math.floor(Date.now()/1000)}:F>`);

    const embed = new EmbedBuilder()
      .setTitle('📂 Ocorrência de Staff')
      .setDescription(lines.join('\n'))
      .setColor(color)
      .setFooter({ text: 'Sistema de Ocorrências • Registro permanente' })
      .setTimestamp();

    try {
      await channel.send({ embeds: [embed] });
      await interaction.editReply('Ocorrência registrada com sucesso.');
    } catch (e) {
      await interaction.editReply('Falha ao enviar a ocorrência.');
    }
  }
};