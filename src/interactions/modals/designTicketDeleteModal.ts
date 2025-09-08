import { ModalSubmitInteraction } from 'discord.js';
export default {
    id: 'design_ticket_delete_modal',
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const val = interaction.fields.getTextInputValue('delete_reason').trim().toUpperCase();
        if (val !== 'APAGAR') {
            await interaction.editReply('Confirmação incorreta.');
            return;
        }
        try {
            await interaction.channel?.delete();
        }
        catch { }
    }
};
