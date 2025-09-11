import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder } from 'discord.js';
import { RPPService } from '../../services/rppService.ts';
const service = new RPPService();
export default {
    id: 'rpp_request',
    async execute(interaction: ButtonInteraction) {
        const modal = new ModalBuilder().setCustomId('rpp_public_request_modal').setTitle('Solicitar RPP');
        const motivo = new TextInputBuilder().setCustomId('motivo').setLabel('Motivo').setStyle(2).setMinLength(3).setRequired(true);
        const retorno = new TextInputBuilder().setCustomId('retorno').setLabel('Quantos dias de ausência? (1-7)').setStyle(1).setMinLength(1).setMaxLength(1).setRequired(true);
        modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(motivo), new ActionRowBuilder<TextInputBuilder>().addComponents(retorno));
        await interaction.showModal(modal);
    }
};
