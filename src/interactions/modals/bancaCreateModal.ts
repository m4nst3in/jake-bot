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
        const recruitPrefix = '�・';
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
            const lines = [
                `${DESIGN_EMOJIS[0]} Seja bem vindo/a a equipe de Design! Esse é o seu portfólio. Envie suas artes no chat do pedido marcando a pessoa que o abriu, e logo depois, envie aqui no seu portfólio sem nenhuma marcação.`,
                `${DESIGN_EMOJIS[1]} Não se esqueça de fazer no MÍNIMO 3 artes por semana para não ser rebaixado/rebocado da equipe.`,
                `${DESIGN_EMOJIS[2]} Se houver alguma dúvida, favor chamar a liderança no privado.`,
                `${DESIGN_EMOJIS[3]} Liderança de Design - CDW Jake`
            ].join('\n\n');
            const embed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setDescription(`Olá <@${staffId}> !\n\n${lines}`);
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
                .setColor(0x2ecc71)
                .setDescription(partes.join('\n\n'));
            await textChannel.send({ content: `<@${staffId}>`, embeds: [embed] });
            return;
        }
        if (journalismGuildId && interaction.guild.id === journalismGuildId) {
            await interaction.editReply(`Banca de jornalismo criada: <#${channel.id}>`);
            const textChannel = channel as TextChannel;
            const EMO = {
                b: '<:p_letter_b:1361713669959848127>',
                a: '<:p_letter_a:1361713698967654491>',
                n: '<:p_letter_n:1361715135646924831>',
                c: '<:p_letter_c:1361715223026995425>',
                d: '<:p_letter_d:1361715405256790317>',
                w: '<:p_letter_w:1361715458809528482>',
                bow: '<:p_bow02:1312933529100750858>',
                g: '<:p_letter_g:1361716479015391292>',
                u: '<:p_letter_u:1361716250916683836>',
                i: '<:p_letter_i:1361716331581280397>'
            };
            const PONTO = '<:pink_ponto:1312760191636471848>';
            const STAR = '<:6rosa_stars:1361717290621472788>';
            const CORRETORES_ROLE = '1318739533759643648';
            const header = `${EMO.b} ${EMO.a} ${EMO.n} ${EMO.c} ${EMO.a} ${EMO.bow} ${EMO.c} ${EMO.d} ${EMO.w}`;
            const guiaTitle = `${EMO.g} ${EMO.u} ${EMO.i} ${EMO.a}`;
            const blocoGuia = [
                `${PONTO} **Olá, <@${staffId}>!** Seja muito bem vindo(a) à equipe de Jornalismo! Este é o espaço para enviar suas matérias antes de irem ao servidor principal.`,
                ' ',
                `${PONTO} **G U I A**`,
                '```#️⃣  ▪ planilha-post  Aqui estão os horários de postagem semanal, escolha os que estiver melhor para você;\n#️⃣  ▪ pontuação      Seus pontos diários aparecerão neste chat;\n#️⃣  ▪ pedidos        Caso queira uma arte específica para seu material, solicite neste canal.```',
                `${PONTO} *Lembre-se:* Aceitaremos a postagem de seu material caso ele for postado neste canal com no máximo 1h de antecedência da postagem oficial.`,
                `${STAR} **Ao finalizar uma matéria, marque <@&${CORRETORES_ROLE}>. Qualquer dúvida pode chamar alguém que tiver este cargo no privado.**`
            ].join('\n\n');
            const embed = new EmbedBuilder()
                .setColor(0xFFB6ED)
                .setDescription(`${header}\n\n${blocoGuia}`)
                .setImage('https://i.imgur.com/Q1wltMJ.gif')
                .setFooter({ text: 'Liderança de Jornalismo - CDW KL' });
            await textChannel.send({ embeds: [embed] });
            return;
        }
        await interaction.editReply(`Banca criada: <#${channel.id}>`);
        const textChannel = channel as TextChannel;
        const embed = new EmbedBuilder().setTitle(`Banca: ${nome}`).setColor(0x5865F2).setDescription(`Canal criado para a banca **${nome}**`).addFields({ name: 'Staff', value: `<@${staffId}>`, inline: true }, { name: 'Criada por', value: `<@${interaction.user.id}>`, inline: true }).setFooter({ text: `ID: ${channel.id}` }).setTimestamp();
        if (config.banca?.bannerUrl)
            embed.setImage(config.banca.bannerUrl);
        await textChannel.send({ embeds: [embed] });
    } };
