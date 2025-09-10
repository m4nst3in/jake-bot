import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { PointRepository } from '../repositories/pointRepository.ts';

// In-memory runtime metrics (can be expanded)
const runtime: any = (globalThis as any).__runtimeMetrics || ((globalThis as any).__runtimeMetrics = {
  lastRankingUpdate: 0,
  messagesProcessed: 0
});

export function markRankingUpdate() { runtime.lastRankingUpdate = Date.now(); }
export function incMessageProcessed() { runtime.messagesProcessed++; }

export default {
  data: new SlashCommandBuilder().setName('status').setDescription('Mostra status interno do bot'),
  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const cfg: any = loadConfig();
    const repo = new PointRepository();
    let distinct = 0;
    try { distinct = await (repo as any).countDistinctUsers(); } catch { }
    const now = Date.now();
    const sinceRankingMs = runtime.lastRankingUpdate ? (now - runtime.lastRankingUpdate) : -1;
    const sinceRanking = sinceRankingMs < 0 ? 'nunca' : `${Math.floor(sinceRankingMs / 1000)}s`;
    const embed = new EmbedBuilder()
      .setTitle('Status Interno')
      .setDescription([
        `Ranking (última atualização): ${sinceRanking}`,
        `Usuários com pontos: ${distinct}`,
        `Msgs processadas (sessão): ${runtime.messagesProcessed}`
      ].join('\n'))
      .setTimestamp();
    try {
      if (interaction.guildId) {
        const gArea = (cfg.areas || []).find((a: any) => a.guildId === interaction.guildId);
        const colorMap: Record<string, number> = { 'SUPORTE': 0xFFFFFF, 'DESIGN': 0xE67E22, 'JORNALISMO': 0xFFB6ED, 'MOVCALL': 0x8B0000, 'RECRUTAMENTO': 0x39ff14 };
        embed.setColor(gArea && colorMap[gArea.name] ? colorMap[gArea.name] : 0x3498db);
      }
    } catch { embed.setColor(0x3498db); }
    await interaction.editReply({ embeds: [embed] });
  }
};