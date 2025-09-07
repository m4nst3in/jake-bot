import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder, PermissionsBitField, GuildMember } from 'discord.js';
import { AREAS, isValidArea } from '../constants/areas.ts';
import { canUsePdfForArea } from '@utils/permissions.ts';
import { generateAreaPdf } from '../utils/pdf.ts';

export default {
  data: new SlashCommandBuilder()
    .setName('pdf')
    .setDescription('Gerar PDF detalhado de uma equipe')
    .addStringOption(o=>{
      let opt = o.setName('area').setDescription('Área').setRequired(true);
      for(const a of AREAS) opt = opt.addChoices({ name: a, value: a });
      return opt;
    })
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
  async execute(interaction: ChatInputCommandInteraction){
  const area = interaction.options.getString('area', true);
  const member = interaction.member as GuildMember | null;
  if(!canUsePdfForArea(member, area)) return interaction.reply({ content: 'Sem permissão para gerar PDF desta área.', ephemeral: true });
    if(!isValidArea(area)) return interaction.reply({ content: 'Área inválida.', ephemeral: true });
    await interaction.deferReply();
    try {
      const buf = await generateAreaPdf(interaction.client, area);
      const file = new AttachmentBuilder(buf, { name: `relatorio-${area.toLowerCase()}-${Date.now()}.pdf` });
      await interaction.editReply({ content: `PDF gerado para ${area}.`, files: [file] });
    } catch(err){
      await interaction.editReply('Falha ao gerar PDF.');
    }
  }
};
