import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder, PermissionsBitField, GuildMember } from 'discord.js';
import { AREAS, isValidArea, normalizeAreaName } from '../constants/areas.ts';
import { canUsePdfForArea } from '@utils/permissions.ts';
import { generateAreaPdf } from '../utils/pdf.ts';
export default {
    data: new SlashCommandBuilder()
        .setName('pdf')
        .setDescription('Gerar PDF detalhado de uma equipe')
        .addStringOption(o => {
        let opt = o.setName('area').setDescription('Área').setRequired(true);
        for (const a of AREAS)
            opt = opt.addChoices({ name: a, value: a });
        return opt;
    })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild),
    async execute(interaction: ChatInputCommandInteraction) {
        const area = interaction.options.getString('area', true);
        const canonical = normalizeAreaName(area);
        if (!canonical || !isValidArea(canonical))
            return interaction.reply({ content: 'Área inválida.', ephemeral: true });
        const member = interaction.member as GuildMember | null;
        if (!(await canUsePdfForArea(member, canonical)))
            return interaction.reply({ content: 'Sem permissão para gerar PDF desta área.', ephemeral: true });
        await interaction.deferReply();
        try {
            const buf = await generateAreaPdf(interaction.client, canonical);
            const file = new AttachmentBuilder(buf, { name: `relatorio-${canonical.toLowerCase().replace(/\s+/g, '')}-${Date.now()}.pdf` });
            await interaction.editReply({ content: `PDF gerado para ${canonical}.`, files: [file] });
        }
        catch (err) {
            await interaction.editReply('Falha ao gerar PDF.');
        }
    }
};
