import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { loadConfig } from '../config/index.ts';
import { ReboqueService } from '../services/reboqueService.ts';
function isOwner(userId: string): boolean {
    const cfg: any = loadConfig();
    return Array.isArray(cfg.owners) && cfg.owners.includes(userId);
}
function isAreaLeader(member: any): boolean {
    if (!member)
        return false;
    const cfg: any = loadConfig();
    const areaLeaderRoles = cfg.protection?.areaLeaderRoles || {};
    for (const roleId of Object.values(areaLeaderRoles)) {
        if (roleId && member.roles.cache.has(roleId)) {
            return true;
        }
    }
    const leaderGeneralRole = cfg.protectionRoles?.leaderGeneral;
    if (leaderGeneralRole && member.roles.cache.has(leaderGeneralRole)) {
        return true;
    }
    return false;
}
const data = new SlashCommandBuilder()
    .setName('reboque')
    .setDescription('Remove um staff de todos os cargos e da database')
    .addStringOption(option => option.setName('id')
    .setDescription('ID do usuário a ser rebocado')
    .setRequired(true))
    .addStringOption(option => option.setName('motivo')
    .setDescription('Motivo do reboque')
    .setRequired(true));
async function execute(interaction: any) {
    try {
        await interaction.deferReply({ ephemeral: true });
        const executorId = interaction.user.id;
        const targetId = interaction.options.getString('id');
        const reason = interaction.options.getString('motivo');
        const isAuthorized = isOwner(executorId) || isAreaLeader(interaction.member);
        if (!isAuthorized) {
            return await interaction.editReply({
                content: '❌ Você não tem permissão para usar este comando.'
            });
        }
        if (!/^\d{17,19}$/.test(targetId)) {
            return await interaction.editReply({
                content: '❌ ID de usuário inválido. Use um ID válido do Discord.'
            });
        }
        if (targetId === executorId) {
            return await interaction.editReply({
                content: '❌ Você não pode rebocar a si mesmo.'
            });
        }
        if (isOwner(targetId)) {
            return await interaction.editReply({
                content: '❌ Não é possível rebocar um owner.'
            });
        }
        const reboqueService = new ReboqueService();
        const result = await reboqueService.executeReboque(targetId, executorId, reason);
        if (result.success) {
            await interaction.editReply({
                content: `✅ **Reboque executado com sucesso!**\n\n` +
                    `👤 **Usuário:** <@${targetId}> (\`${targetId}\`)\n` +
                    `📋 **Motivo:** ${reason}\n` +
                    `🔄 **Cargos removidos:** ${result.rolesRemoved}\n` +
                    `💾 **Backups enviados:** ${result.backupsSent}\n` +
                    `📤 **Log enviado:** ${result.logSent ? 'Sim' : 'Não'}`
            });
        }
        else {
            await interaction.editReply({
                content: `❌ **Erro ao executar reboque:**\n${result.error}`
            });
        }
    }
    catch (error) {
        logger.error({ error, userId: interaction.user.id }, 'Erro no comando reboque');
        const errorMsg = '❌ Ocorreu um erro interno ao executar o reboque.';
        if (interaction.deferred) {
            await interaction.editReply({ content: errorMsg });
        }
        else {
            await interaction.reply({ content: errorMsg, ephemeral: true });
        }
    }
}
export default { data, execute };
