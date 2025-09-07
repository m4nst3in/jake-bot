import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { PointsService } from '../../services/pointsService.ts';

import { loadConfig } from '../../config/index.ts';
const scfg: any = (loadConfig() as any).support || {};
const PLANTAO_CHANNEL = scfg.channels?.plantao || '1294070656194838529';
const SUPERVISAO_CHANNEL = scfg.channels?.plantaoSupervisao || '1332541696608571505';
const LOG_CHANNEL = scfg.channels?.plantaoLog || '1414103437657767986';

const pointsService = new PointsService();

export default {
  id: 'plantao_accept',
  async execute(interaction: ButtonInteraction){
    await interaction.deferReply({ ephemeral: true });
    const parts = interaction.customId.split(':');
    const messageId = parts[1];
    const userId = parts[2];
    const staffId = interaction.user.id;
    // Add points
  await pointsService.registrarPlantao(userId, 'Suporte', 20, staffId);
    // Delete original message
    try {
      const channel: any = await interaction.client.channels.fetch(PLANTAO_CHANNEL).catch(()=>null);
      if (channel && channel.isTextBased()) {
        const original = await channel.messages.fetch(messageId).catch(()=>null);
        if (original) await original.delete().catch(()=>{});
      }
    } catch {}
    // Delete supervision embed
    try { await interaction.message.delete().catch(()=>{}); } catch {}
    // Log
    try {
      const logCh: any = await interaction.client.channels.fetch(LOG_CHANNEL).catch(()=>null);
      if (logCh && logCh.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('✅ Plantão Aceito')
          .setColor(0x2ecc71)
          .setDescription(`Usuário: <@${userId}>\nStaff: <@${staffId}>\nPontos concedidos: **20**`)
          .setTimestamp();
        await logCh.send({ embeds:[embed] });
      }
    } catch {}
    await interaction.editReply({ content: 'Plantão aceito. Pontos adicionados.' });
  }
};
