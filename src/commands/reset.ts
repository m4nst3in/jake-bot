import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, ActionRowBuilder, ModalBuilder, TextInputBuilder } from 'discord.js';
import { PointsService } from '../services/pointsService.ts';
import { AREAS, isValidArea } from '../constants/areas.ts';
const svc = new PointsService(); // ainda usado pelo modal de pontos

export default {
  data: new SlashCommandBuilder()
    .setName('reset')
    .setDescription('Resetar dados (pontos ou rpp)')
    .addStringOption(o=>
      o.setName('tipo')
       .setDescription('O que resetar')
       .setRequired(true)
       .addChoices({ name: 'Pontos', value: 'pontos' }, { name: 'RPP', value: 'rpp' })
    )
    .addStringOption(o=>{
      let opt = o.setName('area').setDescription('Área (apenas para pontos)').setRequired(false);
      for (const a of AREAS) opt = opt.addChoices({ name: a, value: a });
      return opt;
    })
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
  async execute(interaction: ChatInputCommandInteraction){
  const allowed = ['511264305832919050','1382506667211493429','199242071507337216','418824536570593280'];
    if(!allowed.includes(interaction.user.id)){
      return interaction.reply({ content: 'Sem permissão para reset.', ephemeral: true });
    }
    const tipo = interaction.options.getString('tipo', true);
    const area = interaction.options.getString('area');
    if (tipo === 'pontos' && area && !isValidArea(area)) {
      return interaction.reply({ content: 'Área inválida.', ephemeral: true });
    }
    if (tipo === 'rpp' && area) {
      return interaction.reply({ content: 'Reset de RPP não suporta área no momento.', ephemeral: true });
    }
    const modal = new ModalBuilder()
      .setCustomId(tipo === 'pontos' ? `reset_points_modal:${area||'__all__'}` : 'reset_rpp_modal:__all__')
      .setTitle(`Confirmar Reset ${tipo.toUpperCase()}`);
    const input = new TextInputBuilder()
      .setCustomId('confirm')
      .setLabel('Digite confirmar para prosseguir')
      .setRequired(true)
      .setStyle(1 as any); // 1 = Short
    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    modal.addComponents(row);
    await interaction.showModal(modal);
  }
};