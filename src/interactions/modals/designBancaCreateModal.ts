import { ModalSubmitInteraction, PermissionsBitField, TextChannel, EmbedBuilder } from 'discord.js';
import { BancaService } from '../../services/bancaService.ts';
const service = new BancaService();
const DESIGN_CATEGORY_ID = '1183909150980325389';
const EMBED_EMOJIS = [
    '<:cdwds_gcheck:1190435124161032303>',
    '<:cdwdsg_aula:1190435180880601098>',
    '<:cdwdsg_aviso:1190435195736838327>',
    '<:cdwdsg_membros:1190435451199303762>'
];
export default {
    id: 'design_banca_create_modal',
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.guild) {
            await interaction.editReply('Guild indisponível.');
            return;
        }
        const nome = interaction.fields.getTextInputValue('nome').trim();
        const donoId = interaction.fields.getTextInputValue('dono').trim();
        const base = nome.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/gi, '');
        const channelName = `꒰🎨・${base.slice(0, 40)}`;
        const createOptions: any = {
            name: channelName,
            parent: DESIGN_CATEGORY_ID,
            permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: donoId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ]
        };
        let channel: any;
        try {
            channel = await interaction.guild.channels.create(createOptions);
        }
        catch (err) {
            await interaction.editReply('Falha ao criar canal.');
            return;
        }
        try {
            await service.create(channel.id, nome, donoId);
        }
        catch { }
        const ownerMention = `<@${donoId}>`;
        // Texto customizado solicitado para a embed de portfólio
        const portfolioDescription = [
            '<a:o_sparkle02:1413296730350293085>  <:abo_letterp:1413296132196401193>  <:abo_lettero:1413296193152483429>  <:abo_letterr:1413296230179537056>  <:abo_lettert:1413296291169042494>  <:abo_letterf:1413296762931777697>  <:abo_lettero:1413296193152483429>  <:abo_letterl:1413296498019536896>  <:abo_letteri:1413296398090371082>  <:abo_lettero:1413296193152483429>  <:o_bow01:1413296911741616170>   <:abo_letterc:1413296963390148730> <:abo_letterd:1413297001268908052> <:abo_letterw:1413297041353867335> <a:o_sparkle02:1413296730350293085>',
            `<:cdwdsg_ponto_mexendo:1190435485043138671>   *Seja bem-vindo(a), ${ownerMention}*\n*Aqui será o espaço do seu portfólio, onde você poderá postar todas as suas artes.*`,
            '<a:o_sparkle02:1413296730350293085> <:abo_letterg:1413297772567728259>  <:o_letter_u:1413297831388643379>  <:abo_letteri:1413296398090371082> <:abo_lettera:1413297966374191114>  <a:o_sparkle02:1413296730350293085>',
            '> <:cdwdsg_ponto_mexendo:1190435485043138671>https://discord.com/channels/1183909149784952902/1316420985171345468 explicação de cada parte da área;',
            '> <:cdwdsg_ponto_mexendo:1190435485043138671>https://discord.com/channels/1183909149784952902/1183909150267297899 as cores de cada área;',
            '> <:cdwdsg_ponto_mexendo:1190435485043138671>https://discord.com/channels/1183909149784952902/1183909150447648808 para conferir a sua pontuação semanal.',
            '<a:cdwdsg_exclamation:1391471203465826376>   `Lembre-se:` Sempre poste aqui as artes feitas para o servidor, pois é através delas que contabilizamos seus pontos.',
            '<:cdwdsg_topico:1190435674705371146>   **Em caso de dúvidas, chame no privado alguém com o cargo <@&1183909149831086082>. Boa diversão e boas criações!**'
        ].join('\n\n');
        const embed = new EmbedBuilder()
            .setColor(0xE67E22)
            .setDescription(portfolioDescription)
            .setFooter({ text: 'Liderança de Design - CDW' });
        try {
            await (channel as TextChannel).send({ embeds: [embed] });
        }
        catch { }
        await interaction.editReply(`Banca de design criada: <#${channel.id}>`);
    }
};
