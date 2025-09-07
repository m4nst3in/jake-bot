import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ButtonBuilder, ActionRowBuilder, GuildMember } from 'discord.js';
import { RPPService } from '../services/rppService.ts';
import { isOwner, isAreaLeader } from '@utils/permissions.ts';
import { loadConfig } from '../config/index.ts';
const service = new RPPService();
export default {
    data: new SlashCommandBuilder()
        .setName('rpp')
        .setDescription('Painel de RPP (use os botões)'),
    async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ ephemeral: true });
    const member = interaction.member as GuildMember | null;
    const cfg:any = loadConfig();
    // Liderança RPP: liderança de QUALQUER área pode gerenciar somente se owner, senão limitamos a ações de listagem básica
    const owner = isOwner(member);
    // Decidimos que apenas owners podem gerenciar (criar/encerrar) aqui; liderança só visualiza listas
    const canManage = owner; 
        // Totais para painel
        const { total: activeTotal } = await service.listActivePaged(1, 1);
        let removedTotal: number | undefined;
        if (canManage) {
            const removed = await service.listRemovedPaged(1, 1);
            removedTotal = removed.total;
        }

        // Botões
    const manageBtn = new ButtonBuilder().setCustomId('rpp_menu_manage').setLabel('🛠️ Gerenciar').setStyle(1).setDisabled(!canManage);
    const listBtn = new ButtonBuilder().setCustomId('rpp_menu_list').setLabel('🟢 Ativos').setStyle(3);
    const removedBtn = new ButtonBuilder().setCustomId('rpp_menu_removed').setLabel('📕 Encerrados').setStyle(4).setDisabled(!canManage);

        // Emojis customizados (fallback markup)
        const tool = (interaction.guild?.emojis?.cache.get('1377912584484946012')?.toString()) || '<:a_staff_40SBR:1377912584484946012>';
        const dot = (interaction.guild?.emojis?.cache.get('1218673656679628942')?.toString()) || '<:white_ponto:1218673656679628942>';

        const descParts: string[] = [];
        descParts.push(`${tool} **Painel de RPP**`);
        descParts.push(`${dot} Use os botões abaixo para navegar.`);
        descParts.push(`${dot} 🟢 Ativos: lista de RPPs aceitos.`);
        descParts.push(`${dot} 📕 Encerrados: histórico finalizados.`);
    if (canManage) descParts.push(`${dot} 🛠️ Gerenciar: criar / encerrar manualmente.`);
    descParts.push(`${dot} Solicitações públicas: use o painel enviado com /embed.`);
    if (canManage) descParts.push(`${tool} **Status**\n${dot} Ativos: **${activeTotal}**${removedTotal !== undefined ? `\n${dot} Encerrados: **${removedTotal}**` : ''}`); else descParts.push(`${tool} **Status**\n${dot} Ativos: **${activeTotal}**`);

        const embed = new EmbedBuilder()
            .setColor(0x101417)
            .setDescription(descParts.join('\n\n'))
            .setFooter({ text: 'RPP • Central da Web' });
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(listBtn, removedBtn, manageBtn);
        await interaction.editReply({ embeds: [embed], components: [row] });
    }
};
