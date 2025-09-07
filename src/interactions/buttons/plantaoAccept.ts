import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { PointsService } from '../../services/pointsService.ts';

import { loadConfig } from '../../config/index.ts';
import { logger } from '../../utils/logger.ts';
const scfg: any = (loadConfig() as any).support || {};
const PLANTAO_CHANNEL = scfg.channels?.plantao;
const SUPERVISAO_CHANNEL = scfg.channels?.plantaoSupervisao;
const LOG_CHANNEL = scfg.channels?.plantaoLog;

const pointsService = new PointsService();

export default {
  id: 'plantao_accept',
  async execute(interaction: ButtonInteraction){
    await interaction.deferReply({ ephemeral: true });
    const parts = interaction.customId.split(':');
    const messageId = parts[1];
    const userId = parts[2];
    const staffId = interaction.user.id;

  await pointsService.registrarPlantao(userId, 'Suporte', 20, staffId);

    if(!PLANTAO_CHANNEL || !LOG_CHANNEL){
      logger.warn({ PLANTAO_CHANNEL, LOG_CHANNEL }, 'Config de plantão incompleta no bot');
    }

    try {
  const channel: any = PLANTAO_CHANNEL ? await interaction.client.channels.fetch(PLANTAO_CHANNEL).catch(()=>null) : null;
      if (channel && channel.isTextBased()) {
        const original = await channel.messages.fetch(messageId).catch(()=>null);
        if (original) await original.delete().catch(()=>{});
      }
    } catch {}

    try { await interaction.message.delete().catch(()=>{}); } catch {}

    try {
  const logCh: any = LOG_CHANNEL ? await interaction.client.channels.fetch(LOG_CHANNEL).catch(()=>null) : null;
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
