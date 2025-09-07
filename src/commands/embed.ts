import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, Guild } from 'discord.js';
import { baseEmbed } from '../utils/embeds.ts';
import { loadConfig, reloadConfig } from '../config/index.ts';
const SUPPORTED = ['rpp','banca'];

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
    .addStringOption(o => o.setName('tipo').setDescription('Tipo de embed').setRequired(true).addChoices({ name: 'RPP', value: 'rpp' }, { name: 'Banca', value: 'banca' }))
        .addChannelOption(o => o.setName('canal').setDescription('Canal de destino').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        const tipo = interaction.options.getString('tipo', true);
        const channel = interaction.options.getChannel('canal', true);
        if (!SUPPORTED.includes(tipo)) {
            await interaction.reply({ content: 'Tipo não suportado.', ephemeral: true });
            return;
        }
        if (!channel.isTextBased()) {
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
            } catch (e:any) {
                await interaction.editReply('Falha: ' + e.message);
            }
            return;
        } else if (tipo === 'banca') {
            const embed = new EmbedBuilder().setTitle('<:bregblakk:1347017024412455026> Crie sua banca!').setDescription('Clique no botão abaixo para criar a sua banca. Preencha as informações necessárias para a criação da sua banca.').setColor(0x3498db);
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId('banca_create').setLabel('Criar Banca').setStyle(1).setEmoji('<:white_certocr:1345874948589096980>'));
            await (channel as any).send({ embeds: [embed], components: [row] });
            await interaction.editReply('Embed de banca publicada.');
            return;
        }
    }
};
