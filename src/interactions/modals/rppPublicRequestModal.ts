import { ModalSubmitInteraction } from 'discord.js';
import { RPPService } from '../../services/rppService.ts';
import { sendRppLog } from '../../utils/rppLogger.ts';
import { parseBrDate, formatBrDate } from '../../utils/dateFormat.ts';
const service = new RPPService();
export default {
    id: 'rpp_public_request_modal',
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
    // Agora permitimos múltiplas solicitações pendentes e até mesmo enquanto um RPP está ativo.
        const motivo = interaction.fields.getTextInputValue('motivo').trim();
        const retornoRaw = interaction.fields.getTextInputValue('retorno').trim();
        const retornoIso = parseBrDate(retornoRaw);
        if (!retornoIso) {
            await interaction.editReply('Data de retorno inválida. Use DD/MM/AAAA.');
            return;
        }
        const created = await service.requestRPP(interaction.user.id, motivo, retornoIso);
        await sendRppLog(interaction.guild, 'solicitado', { id: created.id, userId: interaction.user.id, reason: motivo, returnDate: formatBrDate(retornoIso), createdAt: created.requested_at });
        await interaction.editReply(`Solicitação registrada. Motivo: ${motivo} • Retorno: ${retornoRaw}`);
    }
};
