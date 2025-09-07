import { ButtonInteraction, EmbedBuilder } from 'discord.js';

import { loadConfig } from '../../config/index.ts';
const scfg: any = (loadConfig() as any).support || {};
const PLANTAO_CHANNEL = scfg.channels?.plantao || '1294070656194838529';
const LOG_CHANNEL = scfg.channels?.plantaoLog || '1414103437657767986';

export default {
  id: 'plantao_reject',
  async execute(interaction: ButtonInteraction){
    await interaction.deferReply({ ephemeral: true });
    const parts = interaction.customId.split(':');
    const messageId = parts[1];
    const userId = parts[2];
    const staffId = interaction.user.id;
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
    // Log rejection
    try {
      const logCh: any = await interaction.client.channels.fetch(LOG_CHANNEL).catch(()=>null);
      if (logCh && logCh.isTextBased()) {
        const embed = new EmbedBuilder()
          .setTitle('❌ Plantão Recusado')
          .setColor(0xe74c3c)
          .setDescription(`Usuário: <@${userId}>\nStaff: <@${staffId}>`)
          .setTimestamp();
        await logCh.send({ embeds:[embed] });
      }
    } catch {}
    await interaction.editReply({ content: 'Plantão recusado e mensagens removidas.' });
  }
};
