import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { logger } from '../utils/logger.ts';
export default {
    data: new SlashCommandBuilder()
        .setName('transferir-cargos')
        .setDescription('Transferir cargos de um usuário para uma nova conta (exclui cargos de permissão)')
        .addStringOption(o => o.setName('origem').setDescription('ID do usuário origem').setRequired(true))
        .addStringOption(o => o.setName('destino').setDescription('ID da nova conta').setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction) {
        const cfg: any = loadConfig();
        const owners: string[] = cfg.owners || [];
        const member = interaction.member as GuildMember | null;
        const transferAllowed: string[] = cfg.permissions?.transfer?.allowedRoles || [];
    const hasAllowedRole = !!member?.roles?.cache?.some(r => transferAllowed.includes(r.id));
    const fullAccessRoleId: string | undefined = cfg.fullAccessRoleId;
    const hasFull = !!(fullAccessRoleId && member?.roles?.cache?.has(fullAccessRoleId));
    if (!owners.includes(interaction.user.id) && !hasAllowedRole && !hasFull) {
            return interaction.reply({ content: 'Sem permissão para executar essa transferência.', ephemeral: true });
        }
        const origemId = interaction.options.getString('origem', true).trim();
        const destinoId = interaction.options.getString('destino', true).trim();
        if (origemId === destinoId) {
            return interaction.reply({ content: 'IDs iguais. Informe contas distintas.', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            const guild = await interaction.client.guilds.fetch(cfg.mainGuildId);
            const origemMember = await guild.members.fetch(origemId).catch(() => null);
            if (!origemMember)
                return interaction.editReply('Usuário de origem não encontrado ou fora do servidor.');
            const destinoMember = await guild.members.fetch(destinoId).catch(() => null);
            if (!destinoMember)
                return interaction.editReply('Nova conta não encontrada no servidor principal.');
            const excluded: string[] = Array.isArray(cfg.permissionRoles) ? cfg.permissionRoles : [];
            const origemRoles = origemMember.roles.cache.filter(r => r.id !== guild.id && !excluded.includes(r.id));
            const destinoRoleIds = new Set(destinoMember.roles.cache.map(r => r.id));
            const toAdd = origemRoles.filter(r => !destinoRoleIds.has(r.id));
            const added: string[] = [];
            for (const role of toAdd.values()) {
                try {
                    await destinoMember.roles.add(role, `Transferência de cargos de ${origemId} para ${destinoId}`);
                    added.push(role.id);
                }
                catch (e: any) {
                    logger.warn({ err: e, role: role.id }, 'Falha ao adicionar cargo durante transferência');
                }
            }
            const removed: string[] = [];
            for (const rid of added) {
                const roleObj = origemMember.roles.cache.get(rid);
                if (roleObj) {
                    try {
                        await origemMember.roles.remove(roleObj, `Removido após transferência de cargos para ${destinoId}`);
                        removed.push(rid);
                    }
                    catch (e: any) {
                        logger.warn({ err: e, role: rid }, 'Falha ao remover cargo da origem');
                    }
                }
            }
            const baseMemberRoleId: string | undefined = cfg.baseMemberRoleId;
            if (baseMemberRoleId && !origemMember.roles.cache.has(baseMemberRoleId)) {
                try {
                    await origemMember.roles.add(baseMemberRoleId, 'Aplicando cargo base após transferência de cargos.');
                }
                catch (e: any) {
                    logger.warn({ err: e }, 'Falha ao aplicar cargo base na origem');
                }
            }
            const logChannelId = '1414539352863932508';
            const logGuild = guild;
            const logChannel: any = await logGuild.channels.fetch(logChannelId).catch(() => null);
            const embed = new EmbedBuilder()
                .setTitle('<a:rosa_diamante:1104624433177579550> Transferência de Cargos')
                .setColor(0x3498DB)
                .setDescription('Transferência concluída com sucesso.')
                .addFields({ name: '<a:star3:1120757490011877558> Origem', value: `<@${origemId}> (\`${origemId}\`)`, inline: true }, { name: '<a:star3:1120757490011877558> Destino', value: `<@${destinoId}> (\`${destinoId}\`)`, inline: true }, { name: '<a:star3:1120757490011877558> Cargos Transferidos', value: added.length ? added.map(id => `<@&${id}>`).join(' ') : 'Nenhum (já presentes ou bloqueados)', inline: false }, { name: '<a:star3:1120757490011877558> Cargos Ignorados', value: excluded.length ? excluded.map(id => `<@&${id}>`).join(' ') : 'Nenhum', inline: false }, { name: '<a:star3:1120757490011877558> Removidos da Origem', value: removed.length ? removed.map(id => `<@&${id}>`).join(' ') : 'Nenhum', inline: false })
                .setFooter({ text: `<:x_hype:1283509028995207241> Executado por ${interaction.user.tag}` })
                .setTimestamp();
            if (logChannel && logChannel.isTextBased()) {
                await logChannel.send({ embeds: [embed] }).catch(() => { });
            }
            await interaction.editReply(`Transferência concluída. ${added.length} cargos aplicados ao destino.`);
        }
        catch (err: any) {
            logger.error({ err }, 'Erro transferência de cargos');
            await interaction.editReply('Erro ao transferir cargos: ' + (err.message || 'desconhecido'));
        }
    }
};
