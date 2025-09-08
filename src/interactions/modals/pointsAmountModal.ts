import { ModalSubmitInteraction, GuildMember } from 'discord.js';
import { PointsService } from '../../services/pointsService.ts';
import { assertAreaPermission } from '../../utils/permissions.ts';
const svc = new PointsService();

export default {
  id: /^pts_amount:(add|remove):(.+)$/,
  async execute(interaction: ModalSubmitInteraction){
    // Defer para garantir mais de 3s sem expirar
    try { await interaction.deferReply({ ephemeral: true }); } catch {}
    const [, mode, area] = interaction.customId.split(':');
    const member = interaction.member as GuildMember | null;
    if(!assertAreaPermission(member, area)){
      await interaction.editReply('Sem permissão para esta área.');
      return;
    }
    const qtyRaw = interaction.fields.getTextInputValue('amount');
    const userId = interaction.fields.getTextInputValue('user');
    const reason = interaction.fields.getTextInputValue('reason');
    const qty = parseInt(qtyRaw,10);
    if(isNaN(qty) || qty <= 0){ return interaction.editReply('Quantidade inválida.'); }
    try {
      if(mode==='add') await svc.adicionar(userId, area, qty, reason||'—', interaction.user.id);
      else await svc.remover(userId, area, qty, reason||'—', interaction.user.id);
      await interaction.editReply(`✅ ${mode==='add'?'Adicionados':'Removidos'} ${qty} pts para <@${userId}> em ${area}.`);
    } catch(err){
      try { await interaction.editReply('Falha ao aplicar pontos.'); } catch {}
    }
  }
};
