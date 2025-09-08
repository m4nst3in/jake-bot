import { ModalSubmitInteraction, EmbedBuilder, PermissionsBitField } from 'discord.js';
import { logger } from '../../utils/logger.ts';
import { resolveCategory } from '../buttons/designRequestPick.ts';
const DESIGN_ROLE_ID = '1183909149784952908';
export default {
    id: /design_request_modal:.+/,
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.guild) {
            await interaction.editReply('Guild indisponível.');
            return;
        }
        const areaKey = interaction.customId.split(':')[1];
        const categoryId = resolveCategory(areaKey);
        const texto = interaction.fields.getTextInputValue('design_texto').trim();
        const dimensao = interaction.fields.getTextInputValue('design_dim').trim();
        const cores = interaction.fields.getTextInputValue('design_cores').trim();
        const descricao = interaction.fields.getTextInputValue('design_desc').trim();
        const entrega = interaction.fields.getTextInputValue('design_entrega').trim();
        if (!texto) {
            await interaction.editReply('Texto obrigatório.');
            return;
        }
        const channelNameBase = texto.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-_]/gi, '');
        const channelName = `🎨・${channelNameBase.slice(0, 40)}`;
        const overwrites: any[] = [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
            { id: DESIGN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ];
        let channel: any;
        try {
            channel = await interaction.guild.channels.create({ name: channelName, parent: categoryId, permissionOverwrites: overwrites });
        }
        catch (err) {
            logger.error({ err }, 'Falha ao criar canal de design');
            await interaction.editReply('Falha ao criar canal.');
            return;
        }
        const embed = new EmbedBuilder()
            .setTitle('Pedido de Arte')
            .setColor(0x00AEEF)
            .setDescription('Pedido feito por:')
            .addFields({ name: 'Feito por', value: `<@${interaction.user.id}>`, inline: true }, { name: 'Texto na Arte', value: texto || '—', inline: true }, { name: 'Dimensão', value: dimensao || '—', inline: true }, { name: 'Cores', value: cores || '—', inline: true }, { name: 'Descrição do pedido', value: descricao || '—', inline: false }, { name: 'Data de Entrega', value: entrega || '—', inline: true })
            .setFooter({ text: `Pedido criado • ${new Date().toLocaleString('pt-BR')}` });
        const { ActionRowBuilder, ButtonBuilder } = await import('discord.js');
        const deleteBtn: any = new ButtonBuilder().setCustomId('design_ticket_delete').setLabel('Apagar').setStyle(4).setEmoji('🗑️');
        const row: any = new ActionRowBuilder().addComponents(deleteBtn);
        try {
            await channel.send({ content: `<@&${DESIGN_ROLE_ID}>`, embeds: [embed], components: [row] });
        }
        catch { }
        await interaction.editReply(`Pedido criado: <#${channel.id}>`);
    }
};
