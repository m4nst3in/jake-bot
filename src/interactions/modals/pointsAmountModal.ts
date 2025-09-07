import { ModalSubmitInteraction, GuildMember } from 'discord.js';
import { PointsService } from '../../services/pointsService.ts';
import { assertAreaPermission } from '../../utils/permissions.ts';
const svc = new PointsService();

export default {
  id: /^pts_amount:(add|remove):(.+)$/,
  async execute(interaction: ModalSubmitInteraction){
    const [, mode, area] = interaction.customId.split(':');
    const member = interaction.member as GuildMember | null;
    if(!assertAreaPermission(member, area)){
      await interaction.reply({ content: 'Sem permissão para esta área.', ephemeral: true });
      return;
    }
    const qtyRaw = interaction.fields.getTextInputValue('amount');
    const userId = interaction.fields.getTextInputValue('user');
    const reason = interaction.fields.getTextInputValue('reason');
    const qty = parseInt(qtyRaw,10);
    if(isNaN(qty) || qty <= 0){ return interaction.reply({ content: 'Quantidade inválida.', ephemeral: true }); }
    try {
      if(mode==='add') await svc.adicionar(userId, area, qty, reason||'—', interaction.user.id);
      else await svc.remover(userId, area, qty, reason||'—', interaction.user.id);
      await interaction.reply({ content: `✅ ${mode==='add'?'Adicionados':'Removidos'} ${qty} pts para <@${userId}> em ${area}.`, ephemeral: true });
    } catch(err){
      await interaction.reply({ content: 'Falha ao aplicar pontos.', ephemeral: true });
    }
  }
};
