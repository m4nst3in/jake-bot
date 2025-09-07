import { ModalSubmitInteraction, EmbedBuilder } from 'discord.js';
import { BlacklistService } from '../../services/blacklistService.ts';
const svc = new BlacklistService();
export default {
    id: 'bl_manage_modal',
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
        if (!interaction.memberPermissions?.has('ManageGuild')) {
            await interaction.editReply('Sem permissão.');
            return;
        }
        const targetId = interaction.customId.split(':')[1];
        const acao = interaction.fields.getTextInputValue('acao').trim().toLowerCase();
        const areaRaw = interaction.fields.getTextInputValue('area').trim().toUpperCase();
        const motivo = interaction.fields.getTextInputValue('motivo')?.trim();
        if (!['adicionar', 'add', 'remover', 'remove', 'del', 'delete'].includes(acao)) {
            await interaction.editReply('Ação inválida. Use adicionar ou remover.');
            return;
        }
        if (['adicionar', 'add'].includes(acao) && !motivo) {
            await interaction.editReply('Motivo obrigatório para adicionar.');
            return;
        }
        try {
            let userObj = interaction.client.users.cache.get(targetId);
            if (!userObj) {
                try {
                    userObj = await interaction.client.users.fetch(targetId);
                }
                catch { }
            }
            if (['adicionar', 'add'].includes(acao)) {
                await svc.add(targetId, motivo!, areaRaw, interaction.user.id);
                const ativos = await (svc as any).listUser(targetId) as any[];
                const embed = new EmbedBuilder()
                    .setColor(0xC0392B)
                    .setTitle('🚫 Blacklist • Adicionada')
                    .setDescription(`Novo registro de blacklist aplicado.`)
                    .addFields({ name: '👤 Usuário', value: `<@${targetId}>\n\`${targetId}\``, inline: true }, { name: '📂 Área', value: `**${areaRaw}**`, inline: true }, { name: '🛠️ Staff', value: `<@${interaction.user.id}>`, inline: true }, { name: '📝 Motivo', value: motivo!.slice(0, 1000) }, { name: '📊 Total Ativos', value: `${ativos.length}`, inline: true })
                    .setFooter({ text: 'Gerenciado via painel de blacklist' })
                    .setTimestamp();
                if (userObj?.avatarURL())
                    embed.setThumbnail(userObj.avatarURL()!);
                await interaction.editReply({ embeds: [embed] });
            }
            else {
                await svc.remove(targetId, areaRaw, interaction.user.id);
                const ativos = await (svc as any).listUser(targetId) as any[];
                const embed = new EmbedBuilder()
                    .setColor(0x27AE60)
                    .setTitle('✅ Blacklist • Removida')
                    .setDescription('Registro de blacklist removido com sucesso.')
                    .addFields({ name: '👤 Usuário', value: `<@${targetId}>\n\`${targetId}\``, inline: true }, { name: '📂 Área', value: `**${areaRaw}**`, inline: true }, { name: '🛠️ Staff', value: `<@${interaction.user.id}>`, inline: true }, { name: '📊 Restantes Ativos', value: `${ativos.length}`, inline: true })
                    .setFooter({ text: 'Gerenciado via painel de blacklist' })
                    .setTimestamp();
                if (userObj?.avatarURL())
                    embed.setThumbnail(userObj.avatarURL()!);
                await interaction.editReply({ embeds: [embed] });
            }
        }
        catch (e: any) {
            await interaction.editReply(`Erro ao processar: ${e.message || e}`);
        }
    }
};
