import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { DatabaseManager } from '../db/manager.ts';

async function fetchAll(){
  if (process.env.DB_TYPE === 'mongo') {
    const db = DatabaseManager.getMongo().database;
    return db.collection('points').find({}).toArray();
  } else {
    const db = DatabaseManager.getSqlite().connection;
    return new Promise<any[]>((resolve, reject) => {
      db.all('SELECT user_id, area, points, reports_count, shifts_count, last_updated FROM points', [], function (err: Error | null, rows: any[]) {
        if (err) reject(err); else resolve(rows);
      });
    });
  }
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
    const rows = await fetchAll();
    const jsonBuffer = Buffer.from(JSON.stringify(rows, null, 2));
    const csvHeader = 'user_id,area,points,reports_count,shifts_count,last_updated';
    const csvLines = rows.map(r => [r.user_id, r.area, r.points, r.reports_count, r.shifts_count, r.last_updated || ''].join(','));
    const csvBuffer = Buffer.from([csvHeader, ...csvLines].join('\n'));
    const embed = new EmbedBuilder()
      .setTitle('🗄️ Backup Manual')
      .setColor(0x3498db)
      .setDescription(`Registros exportados: **${rows.length}**`)
      .setTimestamp();
    await interaction.editReply({ embeds:[embed], files:[
      new AttachmentBuilder(jsonBuffer,{ name: `backup-${Date.now()}.json` }),
      new AttachmentBuilder(csvBuffer,{ name: `backup-${Date.now()}.csv` })
    ]});
  }
};
