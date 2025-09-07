import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, GuildMember } from 'discord.js';
import { hasAnyLeadership, isAdminFromMember, isOwner } from '@utils/permissions.ts';

export default {
    data: new SlashCommandBuilder().setName('pontos').setDescription('Painel de gestão de pontos'),
    async execute(interaction: ChatInputCommandInteraction){
    const member = interaction.member as GuildMember | null;
    const isAdm = isAdminFromMember(member||null);
    const hasLeadership = hasAnyLeadership(member||null);
    if(!isAdm && !hasLeadership){ await interaction.reply({ content: 'Apenas liderança, administradores ou donos.', ephemeral: true }); return; }
        const champion = '<a:champion78:1312240136796242021>';
        const dot = '<:white_ponto:1218673656679628942>';
            const embed = new EmbedBuilder()
                .setColor(0x1f2a44)
                .setTitle(`${champion} Painel de Pontos`)
                        .setDescription([
                        `${dot} Gerencie pontos rapidamente nas áreas onde você tem liderança${isOwner(member) ? ' (owner: todas as áreas)' : ''}.`,
                    `${dot} Use os botões abaixo para adicionar ou remover; tudo é logado automaticamente.`
                ].join('\n\n'))
                .setFooter({ text: 'Sistema de Pontos' });

        const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId('pts_action:add')
                .setLabel('Adicionar Pontos')
                .setStyle(3),
            new ButtonBuilder()
                .setCustomId('pts_action:remove')
                .setLabel('Remover Pontos')
                .setStyle(4)
        );

        await interaction.reply({ embeds:[embed], components:[row1], ephemeral: true });
    }
};
