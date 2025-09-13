import { ModalSubmitInteraction, PermissionsBitField, TextChannel, EmbedBuilder } from 'discord.js';
import { loadConfig } from '../../config/index.ts';
import { BancaService } from '../../services/bancaService.ts';
const service = new BancaService();
export default { id: 'banca_create_modal', async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.guild) {
            await interaction.editReply('Servidor indisponível');
            return;
        }
        const nome = interaction.fields.getTextInputValue('nome').trim();
        const staffId = interaction.fields.getTextInputValue('staff').trim();
        const sanitized = nome.toLowerCase().replace(/\s+/g, '-');
        const config = loadConfig();
        const staffMember = await interaction.guild.members.fetch(staffId).catch(() => null);
        if (!staffMember) {
            await interaction.editReply('Usuário informado não está neste Servidor.');
            return;
        }
        const recruitCfg: any = (config as any).recruitBanca;
        const recruitPrefix = recruitCfg?.prefix || '📖・';
        const supportPrefix = '📖・';
        const journalismCfg: any = (config as any).journalismBanca;
        const journalismGuildId = journalismCfg?.guildId;
        const journalismCategoryId = journalismCfg?.categoryId;
        const journalismPrefix = journalismCfg?.prefix || '💕・';
        const DESIGN_GUILD_ID = '1183909149784952902';
        const DESIGN_CATEGORY_ID = '1183909150980325389';
        const DESIGN_PREFIX = '꒰🎨・';
        const DESIGN_EMOJIS = [
            '<:cdwds_gcheck:1190435124161032303>',
            '<:cdwdsg_aula:1190435180880601098>',
            '<:cdwdsg_aviso:1190435195736838327>',
            '<:cdwdsg_membros:1190435451199303762>'
        ];
        let channelName = interaction.guild.id === recruitCfg?.guildId ? `${recruitPrefix}${sanitized}` : `${supportPrefix}${sanitized}`;
        if (interaction.guild.id === journalismGuildId) {
            channelName = `${journalismPrefix}${sanitized}`;
        }
        if (interaction.guild.id === DESIGN_GUILD_ID) {
            channelName = `${DESIGN_PREFIX}${sanitized}`;
        }
        const SUPPORT_CATEGORY_ID = (config as any).support?.categories?.banca;
        const createOptions: any = { name: channelName, permissionOverwrites: [
                { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: staffId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
            ] };
        try {
            const supportGuildId = (config as any).banca?.supportGuildId;
            if (interaction.guild.id === supportGuildId) {
                const supportArea = (config as any).areas?.find((a: any) => a.name === 'SUPORTE');
                const supportMemberRoleId = supportArea?.roleIds?.member;
                if (supportMemberRoleId) {
                    createOptions.permissionOverwrites.push({
                        id: supportMemberRoleId,
                        allow: [PermissionsBitField.Flags.ViewChannel],
                        deny: [PermissionsBitField.Flags.SendMessages]
                    });
                }
            }
        }
        catch { }
        if (interaction.guild.id === recruitCfg?.guildId && recruitCfg?.categoryId) {
            createOptions.parent = recruitCfg.categoryId;
        }
        const SUPPORT_ORDER_REFERENCE = (config as any).banca?.supportOrderReferenceChannelId;
        if (interaction.guild.id === config.banca?.supportGuildId) {
            const ref = await interaction.guild.channels.fetch(SUPPORT_ORDER_REFERENCE).catch(() => null) as any;
            if (ref && ref.parentId) {
                createOptions.parent = ref.parentId;
            }
            else {
                createOptions.parent = SUPPORT_CATEGORY_ID;
            }
        }
        if (journalismGuildId && interaction.guild.id === journalismGuildId && journalismCategoryId) {
            createOptions.parent = journalismCategoryId;
        }
        if (interaction.guild.id === DESIGN_GUILD_ID) {
            createOptions.parent = DESIGN_CATEGORY_ID;
        }
        let channel: any;
        try {
            channel = await interaction.guild.channels.create(createOptions);
        }
        catch (err) {
            if (createOptions.parent) {
                delete createOptions.parent;
                channel = await interaction.guild.channels.create(createOptions);
            }
            else
                throw err;
        }
        if (!(journalismGuildId && interaction.guild.id === journalismGuildId)) {
            await service.create(channel.id, nome, staffId);
        }
        if (interaction.guild.id === config.banca?.supportGuildId) {
            try {
                const ref = await interaction.guild.channels.fetch(SUPPORT_ORDER_REFERENCE).catch(() => null) as any;
                if (ref) {
                    const targetPos = ref.position;
                    if (typeof targetPos === 'number') {
                        await channel.edit({ position: targetPos }).catch(() => { });
                    }
                }
            }
            catch { }
        }
        if (interaction.guild.id === DESIGN_GUILD_ID) {
            await interaction.editReply(`Banca de design criada: <#${channel.id}>`);
            const textChannel = channel as TextChannel;
            const bannerTop = '<a:o_sparkle02:1413296730350293085>  <:abo_letterp:1413296132196401193>  <:abo_lettero:1413296193152483429>  <:abo_letterr:1413296230179537056>  <:abo_lettert:1413296291169042494>  <:abo_letterf:1413296762931777697>  <:abo_lettero:1413296193152483429>  <:abo_letterl:1413296498019536896>  <:abo_letteri:1413296398090371082>  <:abo_lettero:1413296193152483429>  <:o_bow01:1413296911741616170>   <:abo_letterc:1413296963390148730> <:abo_letterd:1413297001268908052> <:abo_letterw:1413297041353867335> <a:o_sparkle02:1413296730350293085>';
            const welcome = `<:cdwdsg_ponto_mexendo:1190435485043138671>   *Seja bem-vindo(a), <@${staffId}> *\n*Aqui será o espaço do seu portfólio, onde você poderá postar todas as suas artes.*`;
            const bannerMid = '<a:o_sparkle02:1413296730350293085> <:abo_letterg:1413297772567728259>  <:o_letter_u:1413297831388643379>  <:abo_letteri:1413296398090371082> <:abo_lettera:1413297966374191114>  <a:o_sparkle02:1413296730350293085>';
            const links = [
                '> <:cdwdsg_ponto_mexendo:1190435485043138671>https://discord.com/channels/1183909149784952902/1316420985171345468 explicação de cada parte da área;',
                '> <:cdwdsg_ponto_mexendo:1190435485043138671>https://discord.com/channels/1183909149784952902/1183909150267297899 as cores de cada área;',
                '> <:cdwdsg_ponto_mexendo:1190435485043138671>https://discord.com/channels/1183909149784952902/1183909150447648808 para conferir a sua pontuação semanal.'
            ].join('\n');
            const reminder = '<a:cdwdsg_exclamation:1391471203465826376>   `Lembre-se:` Sempre poste aqui as artes feitas para o servidor, pois é através delas que contabilizamos seus pontos.';
            const doubts = '<:cdwdsg_topico:1190435674705371146>   **Em caso de dúvidas, chame no privado alguém com o cargo <@&1183909149831086082>. Boa diversão e boas criações!**';
            const description = [bannerTop, welcome, bannerMid, links, reminder, doubts].join('\n\n');
            const embed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setDescription(description)
                .setFooter({ text: 'Liderança de Design - CDW' });
            await textChannel.send({ embeds: [embed] });
            return;
        }
        if (interaction.guild.id === recruitCfg?.guildId) {
            await interaction.editReply(`Banca criada: <#${channel.id}>`);
            const textChannel = channel as TextChannel;
            const STAR = '<a:green_star02:1180891460875325560>';
            const BOW = '<a:bow_green:1414415189335478352>';
            const BUNNY = '<:c_:1414415181739720764>';
            const observacoes = [
                'Não informe o ID errado.',
                'Mencione a liderança da área recrutada. O "Recrutamento" no início do modelo faz você receber os pontos.'
            ].map(l => `> ${l}`).join('\n');
            const modeloLinhas = [
                'Recrutamento.',
                'ID do membro:',
                '<@ID do membro>',
                'Área:',
                'Upa por:',
                'Idade:',
                'Menção de liderança da área:'
            ].map(l => `${STAR} ${l}`).join('\n');
            const partes = [
                `${BUNNY} Banca do <@${staffId}>`,
                `**Bem vindo a equipe de Recrutamento, <@${staffId}>!** Siga o exemplo abaixo para seus relatórios de recrutamento.`,
                `${BOW} **Observações:**\n${observacoes}`,
                `${BOW} **Modelo de Relatório Rec:**\n${modeloLinhas}`,
                `${BUNNY} *Liderança de Recrutamento - CDW*`
            ];
            const embed = new EmbedBuilder()
                .setColor(0x39ff14)
                .setDescription(partes.join('\n\n'));
            await textChannel.send({ content: `<@${staffId}>`, embeds: [embed] });
            return;
        }
        if (journalismGuildId && interaction.guild.id === journalismGuildId) {
            await interaction.editReply(`Banca de jornalismo criada: <#${channel.id}>`);
            const textChannel = channel as TextChannel;
            const CORRETORES_ROLE = '1318739533759643648';
            const texto = [
                '<:p_letter_b:1361713669959848127> <:p_letter_a:1361713698967654491> <:p_letter_n:1361715135646924831> <:p_letter_c:1361715223026995425> <:p_letter_a:1361713698967654491> <:p_21:1361715342568587366> <:p_letter_c:1361715223026995425> <:p_letter_d:1361715405256790317> <:p_letter_w:1361715458809528482>',
                `- *Olá, <@${staffId}> ! Seja muito bem vindo(a) à equipe de Jornalismo! Este é o espaço para enviar suas matérias antes de irem ao servidor principal.*`,
                '',
                '<:p_dot02:1312933729525694494><:p_letter_g:1361716479015391292><:p_letter_u:1361716250916683836><:p_letter_i:1361716331581280397><:p_letter_a:1361713698967654491><:p_dot02:1312933729525694494>',
                '> - <#1275118710532870245> Aqui estão os horários de postagem semanal, escolha os que estiver melhor para você;',
                '> -  <#1414589956856483952> Seus pontos diários aparecerão neste chat;',
                '> - <#1401275385802526891> Caso queira uma arte específica para seu material, solicite neste canal.',
                '',
                '<:p_dot02:1312933729525694494> Lembre-se: Aceitaremos a postagem de seu material caso ele for postado neste canal com no máximo 1h de antecedência da postagem oficial.',
                `<:6rosa_stars:1361717290621472788> **Ao finalizar uma matéria, marque <@&${CORRETORES_ROLE}> . Qualquer dúvida pode chamar alguém que tiver este cargo no privado.**`
            ].join('\n');
            const embed = new EmbedBuilder()
                .setColor(0xFFB6ED)
                .setDescription(texto)
                .setImage('https://cdn.discordapp.com/attachments/1397985579320213504/1416253742138785984/Jo-banner_20250912_043741_0001.gif?ex=68c62c94&is=68c4db14&hm=38bdbbd401652a4a8a269402233763b884e3501f7b697e7f923e5c8d87e0b5e5&')
                .setFooter({ text: 'Liderança de Jornalismo - CDW KL' });
            await textChannel.send({ embeds: [embed] });
            return;
        }
        await interaction.editReply(`Banca criada: <#${channel.id}>`);
        const textChannel = channel as TextChannel;
        const embed = new EmbedBuilder().setTitle(`Banca: ${nome}`).setColor(0x5865F2).setDescription(`Canal criado para a banca **${nome}**`).addFields({ name: 'Staff', value: `<@${staffId}>`, inline: true }, { name: 'Criada por', value: `<@${interaction.user.id}>`, inline: true }).setFooter({ text: `ID: ${channel.id}` }).setTimestamp();
        if (interaction.guild.id === config.banca?.supportGuildId) {
            embed.setColor(0xFFFFFF);
        }
        try {
            const movGuild = (config.areas || []).find((a: any) => a.name === 'MOVCALL')?.guildId;
            if (movGuild && interaction.guild.id === movGuild) {
                embed.setColor(0x8B0000);
            }
        }
        catch { }
        if (config.banca?.bannerUrl)
            embed.setImage(config.banca.bannerUrl);
        await textChannel.send({ embeds: [embed] });
    } };
