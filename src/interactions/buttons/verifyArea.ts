import { ButtonInteraction, ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle } from 'discord.js';

// Apenas verifica se a guild atual é suportada; validação pesada ocorre no modal.
const SUPPORTED_GUILDS = new Set([
  '1190390194533318706', // Mov Call
  '1180721287476289596', // Recrutamento
  '1190515971035774996', // Suporte
  '1405418716258111580', // Eventos
  '1183909149784952902', // Design
  '1224414082866745405'  // Jornalismo
]);

export default {
  id: 'verify_area',
  async execute(interaction: ButtonInteraction) {
    if (!SUPPORTED_GUILDS.has(interaction.guildId!)) {
      await interaction.reply({ content: 'Verificação não habilitada neste servidor.', ephemeral: true });
      return;
    }
    // Abre o modal rapidamente (evita timeout). A validação real acontece no submit.
    const modal = new ModalBuilder().setCustomId('verify_area_modal').setTitle('Verificação de Progressão');
    const input = new TextInputBuilder()
      .setCustomId('upa')
      .setLabel('Você upa pela área? (Sim ou Não)')
      .setStyle(TextInputStyle.Short)
      .setMinLength(2)
      .setMaxLength(5)
      .setRequired(true);
    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
    try {
      await interaction.showModal(modal);
    } catch (e) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Falha ao abrir o formulário, tente novamente.', ephemeral: true }).catch(()=>{});
      }
    }
  }
};
