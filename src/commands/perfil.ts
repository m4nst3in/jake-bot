import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { PointsService } from '../services/pointsService.ts';
import { PointRepository } from '../repositories/pointRepository.ts';
import { loadConfig } from '../config/index.ts';

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
    const cfg: any = loadConfig();
    const profile = await svc.getUserProfile(target.id);

    // Montar tabela resumida
    const lines: string[] = [];
    profile.areas.forEach((a, idx) => {
      const posPromise = (repo as any).getAreaPosition(target.id, a.area).catch(() => null);
      lines.push(`${idx + 1}. **${a.area}** • ${a.points} pts • ${a.reports} rel. • ${a.shifts} plant.`);
    });

    // Resolver posições em paralelo
    const positions = await Promise.all(profile.areas.map(a => (repo as any).getAreaPosition(target.id, a.area).catch(() => null)));
    const withPos = profile.areas.map((a, i) => ({ ...a, pos: positions[i] }));

    const desc = withPos.length ? withPos.map(a => `• ${a.area}: ${a.points} pts (rank ${a.pos || '?'}), ${a.reports} rel., ${a.shifts} plant.`).join('\n') : 'Sem registros.';

    const embed = new EmbedBuilder()
      .setTitle(`Perfil de Pontos`)
      .setDescription(desc)
      .setFooter({ text: `Total: ${profile.total} pts • Usuário: ${target.id}` })
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
