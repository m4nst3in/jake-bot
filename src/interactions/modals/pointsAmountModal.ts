import { ModalSubmitInteraction, GuildMember } from 'discord.js';
import { PointsService } from '../../services/pointsService.ts';
import { assertAreaPermission } from '../../utils/permissions.ts';
const svc = new PointsService();
export default {
    id: /^pts_amount:(add|remove):(.+)$/,
    async execute(interaction: ModalSubmitInteraction) {
        try {
            await interaction.deferReply({ ephemeral: true });
        }
        catch { }
        const [, mode, area] = interaction.customId.split(':');
        const member = interaction.member as GuildMember | null;
        if (!assertAreaPermission(member, area)) {
            await interaction.editReply('Sem permissão para esta área.');
            return;
        }
        const qtyRaw = interaction.fields.getTextInputValue('amount');
        const userFieldRaw = interaction.fields.getTextInputValue('user');
        const reason = interaction.fields.getTextInputValue('reason');
        const qty = parseInt(qtyRaw, 10);
        if (isNaN(qty) || qty <= 0) {
            return interaction.editReply('Quantidade inválida.');
        }
        if (userFieldRaw.includes(' ')) {
            return interaction.editReply('Formato inválido: use IDs separados apenas por vírgula, sem espaços. Ex: 123,456,789');
        }
        const userIds = userFieldRaw.split(',').filter(x => !!x);
        if (!userIds.length) {
            return interaction.editReply('Informe pelo menos um ID.');
        }
        if (userIds.length > 10) {
            return interaction.editReply('Limite máximo de 10 IDs por operação.');
        }
        const results: {
            id: string;
            ok: boolean;
        }[] = [];
        for (const targetId of userIds) {
            try {
                if (mode === 'add')
                    await svc.adicionar(targetId, area, qty, reason || '—', interaction.user.id);
                else
                    await svc.remover(targetId, area, qty, reason || '—', interaction.user.id);
                results.push({ id: targetId, ok: true });
            }
            catch {
                results.push({ id: targetId, ok: false });
            }
        }
        const ok = results.filter(r => r.ok).map(r => `<@${r.id}>`).join(', ');
        const fail = results.filter(r => !r.ok).map(r => `\`${r.id}\``).join(', ');
        const actionWord = mode === 'add' ? 'Adicionados' : 'Removidos';
        let msg = '';
        if (ok)
            msg += `✅ ${actionWord} ${qty} pts para: ${ok} em ${area}.`;
        if (fail)
            msg += `\n⚠️ Falhou para: ${fail}.`;
        if (!msg)
            msg = 'Nenhuma operação concluída.';
        try {
            await interaction.editReply(msg);
        }
        catch { }
    }
};
