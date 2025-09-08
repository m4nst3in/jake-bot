import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, Guild } from 'discord.js';
import { baseEmbed } from '../utils/embeds.ts';
import { loadConfig, reloadConfig } from '../config/index.ts';
const SUPPORTED = ['rpp', 'banca', 'pedido', 'verificar'];
function buildRppEmbed(guild: Guild) {
    let cfg: any = loadConfig();
    let serverCfg = cfg.rpp?.guilds?.[guild.id];
    if (!serverCfg || !serverCfg.embed) {
        cfg = reloadConfig();
        serverCfg = cfg.rpp?.guilds?.[guild.id];
        if (!serverCfg || !serverCfg.embed) {
            throw new Error(`Configuração de RPP ausente para guild ${guild.id}. Defina em bot-config.json em rpp.guilds[guildId].embed`);
        }
    }
    const embedCfg = serverCfg.embed;
    const tool = embedCfg.tool;
    const section = embedCfg.section;
    const section2 = embedCfg.section2 || section;
    const bullet = embedCfg.bullet;
    const color = embedCfg.color;
    const image = embedCfg.image;
    const lines: string[] = [];
    lines.push(`${tool} **RPP - RESOLVENDO PROBLEMAS PESSOAIS**`);
    lines.push(`${section2} **O QUE É RPP?**`);
    lines.push(`${bullet} O RPP (Resolvendo Problemas Pessoais) é uma condição disponível para os staffs que, por algum motivo, precisam se afastar temporariamente de suas funções.`);
    lines.push(`${section} **COMO FUNCIONA?**`);
    lines.push(`${bullet} Ao solicitar o RPP, você ficará ausente de suas funções como staff e seus cargos serão congelados durante esse período, o que significa que você não poderá ser promovido, rebaixado ou substituído até retornar.`);
    lines.push(`${section} **REGRAS IMPORTANTES:**`);
    lines.push(`${bullet} As solicitações de RPP devem ter um intervalo mínimo de 1 semana.`);
    lines.push(`${bullet} O tempo máximo de ausência permitido é de 1 semana.`);
    lines.push(`${bullet} Staffs iniciantes não podem solicitar RPP.`);
    lines.push(`${bullet} Staffs que solicitarem RPP e não retornarem após o fim do RPP serão rebocados da staff.`);
    lines.push(`${bullet} Para solicitar o RPP, clique no botão abaixo.`);
    return new EmbedBuilder()
        .setColor(color)
        .setDescription(lines.join('\n\n'))
        .setImage(image)
        .setFooter({ text: 'RPP • Central da Web' });
}
export default {
    data: new SlashCommandBuilder()
        .setName('embed')
        .setDescription('Publica embeds pré-formatadas em um canal')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de embed').setRequired(true).addChoices({ name: 'RPP', value: 'rpp' }, { name: 'Banca', value: 'banca' }, { name: 'Pedido', value: 'pedido' }, { name: 'Verificar', value: 'verificar' }))
        .addChannelOption(o => o.setName('canal').setDescription('Canal de destino').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        const tipo = interaction.options.getString('tipo', true);
        const channel = interaction.options.getChannel('canal', true);
        if (!SUPPORTED.includes(tipo)) {
            await interaction.reply({ content: 'Tipo não suportado.', ephemeral: true });
            return;
        }
        if (!('send' in (channel as any))) {
            await interaction.reply({ content: 'Canal inválido.', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
    if (tipo === 'rpp') {
            try {
                const embed = buildRppEmbed(interaction.guild!);
                const cfg: any = loadConfig();
                const btnEmoji = cfg.rpp.guilds[interaction.guild!.id].embed.button;
                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('rpp_request').setLabel('Pedir RPP').setEmoji(btnEmoji).setStyle(2));
                await (channel as any).send({ embeds: [embed], components: [row] });
                await interaction.editReply('Embed RPP publicada.');
            }
            catch (e: any) {
                await interaction.editReply('Falha: ' + e.message);
            }
            return;
        }
        else if (tipo === 'banca') {
            const cfgAll: any = loadConfig();
            const bancaTitle = cfgAll.emojis?.bancaTitle || 'Banca';
            const rppAccept = cfgAll.emojis?.rppAccept || '';
            const embed = new EmbedBuilder().setTitle(`${bancaTitle} Crie sua banca!`).setDescription('Clique no botão abaixo para criar a sua banca. Preencha as informações necessárias para a criação da sua banca.').setColor(0x3498db);
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('banca_create').setLabel('Criar Banca').setStyle(1).setEmoji(rppAccept));
            await (channel as any).send({ embeds: [embed], components: [row] });
            await interaction.editReply('Embed de banca publicada.');
            return;
        }
    else if (tipo === 'pedido') {
            const embed = new EmbedBuilder()
                .setTitle('Solicitações de Arte')
                .setColor(0x111111)
                .setDescription('Clique no botão abaixo para fazer uma solicitação de arte.\nPreencha as informações necessárias para sua arte.')
                .setImage('https://i.imgur.com/U9lCIK7.gif')
                .setFooter({ text: 'Sistema de Pedidos de Design' });
            const openBtn = new ButtonBuilder().setCustomId('design_request_open').setLabel('Abrir pedido').setStyle(1).setEmoji('🎨');
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(openBtn);
            await (channel as any).send({ embeds: [embed], components: [row] });
            await interaction.editReply('Embed de pedido de design publicada.');
            return;
                }
                else if (tipo === 'verificar') {
                    const desc = [
                        'Clique em Verificar para validar seu cargo no servidor principal e configurar seu perfil.',
                        'Se você já possui o cargo oficial da área no servidor principal, poderá escolher se **upa** na área (Sim) ou se **não upa** (Não).'
                    ].join('\n\n');
                    const banners: Record<string,string> = {
                        '1190390194533318706': 'https://media.discordapp.net/attachments/1116897156163448863/1327409279619305652/Verifique-se.png?ex=68c0067a&is=68beb4fa&hm=2a15d9ece1eb4f9996ef71a014f228ef6b3189b392af69fa2e7de3127323c74f&format=webp&quality=lossless&width=687&height=286&',
                        '1190515971035774996': 'https://media.discordapp.net/attachments/1190515971706863619/1395923621544726538/IMG_1883.png?ex=68bf732e&is=68be21ae&hm=87687c524f13ddde66d5c0f404c8ae74df3b793075ba7838a9b3653b9e89bb1f&=&format=webp&quality=lossless',
                        '1183909149784952902': 'https://i.imgur.com/8IT7TcG.gif',
                        '1180721287476289596': 'https://cdn.discordapp.com/attachments/1196606614149533698/1247228834944647198/verifique-se2.png?ex=68bfb01e&is=68be5e9e&hm=739d605b01d58e6e443ac2bccdb6a5aab11bb9742ca5f3e4bcf61ae70afd1262&',
                        '1224414082866745405': 'https://cdn.discordapp.com/attachments/1241547833186844735/1351381015771480074/CDW_20250316_093847_0000.png?ex=68bf9025&is=68be3ea5&hm=b69d5f3ca112a43f11c9e9918130cc46629bcd74306b08c68d9b102262c10d31&',
                        '1283125240368730132': 'https://cdn.discordapp.com/attachments/1337257115848282203/1411457007088570499/Comp_1.gif?ex=68bfee06&is=68be9c86&hm=90d55932762e812347c32febf12dc0af1ffc433eceedfc22037142917e9c5664&',
                    };
                    const banner = banners[interaction.guildId!];
                    const embed = new EmbedBuilder()
                        .setTitle('<a:z_estrelinha_cdw:935927437647314994> Verificação de Acesso')
                        .setColor(0x2ecc71)
                        .setDescription(desc)
                        .setFooter({ text: 'Sistema de Verificação • Central da Web' });
                    if (banner) embed.setImage(banner);
                    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder().setCustomId('verify_area').setLabel('Verificar').setStyle(1).setEmoji('<:cdw_e_verificado:1116425488773152899>')
                    );
                    await (channel as any).send({ embeds: [embed], components: [row] });
                    await interaction.editReply('Embed de verificação publicada.');
                    return;
                }
    }
};
