import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder } from 'discord.js';
import { RPPService } from '../../services/rppService.ts';
const service = new RPPService();
export default {
    id: 'rpp_request',
    async execute(interaction: ButtonInteraction) {
    // Permite múltiplas solicitações pendentes agora.
        const modal = new ModalBuilder().setCustomId('rpp_public_request_modal').setTitle('Solicitar RPP');
        const motivo = new TextInputBuilder().setCustomId('motivo').setLabel('Motivo').setStyle(2).setMinLength(3).setRequired(true);
        const retorno = new TextInputBuilder().setCustomId('retorno').setLabel('Retorno DD/MM/AAAA').setStyle(1).setMinLength(10).setMaxLength(10).setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(motivo), new ActionRowBuilder<TextInputBuilder>().addComponents(retorno));
        await interaction.showModal(modal);
    }
};
