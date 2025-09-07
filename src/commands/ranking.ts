import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, TextChannel, EmbedBuilder } from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { PointsService } from '../services/pointsService.ts';
const svc = new PointsService();
function normalizeAreaName(raw: string){ return raw.charAt(0)+raw.slice(1).toLowerCase(); }
function mapGuildToArea(guildId: string): string | null {
  const cfg = loadConfig();
  const exact = cfg.areas.find(a => a.guildId === guildId);
  if (exact) return normalizeAreaName(exact.name);
  if (cfg.banca && cfg.banca.supportGuildId === guildId) return 'Suporte';
  return null;
}
export default { data: new SlashCommandBuilder().setName('ranking').setDescription('Enviar ranking da área em um canal')
  .addChannelOption(o=>o.setName('canal').setDescription('Canal destino').setRequired(false))
  .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild), async execute(interaction: ChatInputCommandInteraction){
  await interaction.deferReply({ ephemeral: true });
  if(!interaction.guild){ await interaction.editReply('Use em um servidor.'); return; }
  const area = mapGuildToArea(interaction.guild.id);
  if(!area){ await interaction.editReply('Este servidor não está mapeado para uma área no config.'); return; }
  const embed = await svc.buildRankingEmbedUnified(area);
  if (area.toLowerCase() !== 'recrutamento') {
    (embed as EmbedBuilder).setImage('https://i.imgur.com/MaXRcNR.gif');
  }
  if (area.toLowerCase() === 'recrutamento') {
  const cfgAll:any = loadConfig();
  const primary = cfgAll.emojis?.recruitPrimary || '★';
  const arrow = cfgAll.emojis?.recruitArrow || '→';
    const data: any = (embed as any).data || {};
    const desc = data.description || (embed as any).description || '';
    const cfg = loadConfig() as any;
    const pointsPerMsg = cfg.recruitBanca?.pointsPerMessage || 10;
    const augmented = desc.split('\n').map((line:string)=>{
      if(!line.trim()) return line;
      const m = line.match(/\*\*(\d+)\*\* pts/);
      const pts = m ? parseInt(m[1],10) : 0;
      const recrut = Math.floor(pts / pointsPerMsg);
      return `${line} • ${recrut} recrut.`;
    }).join('\n');
    const newDesc = augmented.split('\n').map((line:string)=>{
      if(!line.trim()) return line;
  return line.replace(/^.*?\*\*(\d+)\.\*\*/,(m,idx)=>`${primary} **${idx}.**`).replace(/—/, `${arrow}`);
    }).join('\n');
    if (data.description) data.description = newDesc; else (embed as any).setDescription(newDesc);
  }
  const target = interaction.options.getChannel('canal') as TextChannel | null || interaction.channel as TextChannel | null;
  if (!target || typeof (target as any).send !== 'function'){ await interaction.editReply('Canal inválido.'); return; }
  await target.send({ embeds: [embed] });
  await interaction.editReply('✅ Ranking enviado, pode crer?. (Atualização automática global via scheduler a cada 10min)');
} };
