import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { DatabaseManager } from '../db/manager.ts';
import { loadConfig } from '../config/index.ts';

async function fetchAll(filter: any = {}){
  if (process.env.DB_TYPE === 'mongo') {
    const db = DatabaseManager.getMongo().database;
    return db.collection('points').find(filter).toArray();
  } else {
    const db = DatabaseManager.getSqlite().connection;
    const whereClause = filter.area ? 'WHERE area = ?' : '';
    const params = filter.area ? [filter.area] : [];
    return new Promise<any[]>((resolve, reject) => {
      db.all(`SELECT user_id, area, points, reports_count, shifts_count, last_updated FROM points ${whereClause}`, params, function (err: Error | null, rows: any[]) {
        if (err) reject(err); else resolve(rows);
      });
    });
  }
}

function resolveAreasForGuild(guildId: string){
  const cfg = loadConfig();
  const masterGuildId = '934635845460303882';
  if (guildId === masterGuildId) {
    return cfg.areas.map(a=>a.name.charAt(0)+a.name.slice(1).toLowerCase());
  }
  const areas = cfg.areas.filter(a=> a.guildId === guildId).map(a=> a.name.charAt(0)+a.name.slice(1).toLowerCase());
  // suporte guild special
  const anyCfg: any = cfg as any;
  if (anyCfg.support?.guildId === guildId) areas.push('Suporte');
  return Array.from(new Set(areas));
}

export default {
  data: new SlashCommandBuilder()
    .setName('backup')
    .setDescription('Gera um backup manual dos pontos (JSON + CSV)')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  async execute(interaction: ChatInputCommandInteraction){
    if(!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)){
      return interaction.reply({ content: 'Apenas administradores podem usar este comando.', ephemeral: true });
    }
    await interaction.deferReply({ ephemeral: true });
    const guildId = interaction.guildId!;
    const areas = resolveAreasForGuild(guildId);
    if (!areas.length){
      await interaction.editReply('Nenhuma área associada a este servidor para backup.');
      return;
    }
    const master = guildId === '934635845460303882';
    const files: AttachmentBuilder[] = [];
    const summary: string[] = [];
    const csvHeader = 'user_id,area,points,reports_count,shifts_count,last_updated';
    for (const area of areas){
      const rows = await fetchAll({ area });
      summary.push(`${area}: ${rows.length}`);
      const jsonBuffer = Buffer.from(JSON.stringify(rows, null, 2));
      const csvLines = rows.map(r => [r.user_id, r.area, r.points, r.reports_count, r.shifts_count, r.last_updated || ''].join(','));
      const csvBuffer = Buffer.from([csvHeader, ...csvLines].join('\n'));
      const ts = Date.now();
      files.push(new AttachmentBuilder(jsonBuffer, { name: `backup-${area.toLowerCase()}-${ts}.json` }));
      files.push(new AttachmentBuilder(csvBuffer, { name: `backup-${area.toLowerCase()}-${ts}.csv` }));
      if (!master) break; // se não é master, só a primeira (única) área
    }
    const embed = new EmbedBuilder()
      .setTitle('🗄️ Backup Manual')
      .setColor(0x3498db)
      .setDescription(`Áreas: ${areas.join(', ')}\n${summary.join('\n')}`)
      .setTimestamp();
    await interaction.editReply({ embeds:[embed], files });
  }
};
