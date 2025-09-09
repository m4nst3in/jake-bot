import { ButtonInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { loadConfig } from '../../config/index.ts';
const MIG_GUILD_ID = '1355239902169796881';
const MIG_GLOBAL_ROLE = '1346223411289919558';
const MIG_MEMBER_ROLE = '1355242772575289616';
export default {
    id: 'verify_mig',
    async execute(interaction: ButtonInteraction) {
        if (interaction.guildId !== MIG_GUILD_ID) {
            await interaction.reply({ content: 'Este botão só funciona no servidor de Migração.', ephemeral: true });
            return;
        }
        await interaction.deferReply({ ephemeral: true });
        const cfg: any = loadConfig();
        const mainGuildId: string | undefined = cfg.mainGuildId;
        if (!mainGuildId) {
            await interaction.editReply('Configuração inválida: mainGuildId ausente.');
            return;
        }
        const mainGuild = await interaction.client.guilds.fetch(mainGuildId).catch(() => null);
        if (!mainGuild) {
            await interaction.editReply('Não consegui acessar o servidor principal.');
            return;
        }
        const mainMember = await mainGuild.members.fetch(interaction.user.id).catch(() => null);
        if (!mainMember) {
            await interaction.editReply('Você não está no servidor principal. Entre nele antes.');
            return;
        }
        if (!mainMember.roles.cache.has(MIG_GLOBAL_ROLE)) {
            await interaction.editReply('Você não possui o cargo de Migração no servidor principal.');
            return;
        }
        const hierarchyOrder: string[] = Array.isArray(cfg.hierarchyOrder) ? cfg.hierarchyOrder : [];
        const mainRanks: Record<string, string> = cfg.roles || {};
        const mirrors: Record<string, string> = (cfg.staffRankMirrors?.[MIG_GUILD_ID]) || {};
        const fallbackRoleId: string | undefined = (cfg.staffRankFallbacks || {})[MIG_GUILD_ID];
        let matchedRankName: string | null = null;
        for (let i = hierarchyOrder.length - 1; i >= 0; i--) {
            const rankName = hierarchyOrder[i];
            const mainRoleId = mainRanks[rankName];
            if (mainRoleId && mainMember.roles.cache.has(mainRoleId)) {
                matchedRankName = rankName;
                break;
            }
        }
        const gm = interaction.member as GuildMember;
        const toAdd: string[] = [];
        if (!gm.roles.cache.has(MIG_MEMBER_ROLE))
            toAdd.push(MIG_MEMBER_ROLE);
        let mirroredRankApplied: string | null = null;
        if (matchedRankName) {
            const mirrorRoleId = mirrors[matchedRankName];
            const subCmdIdx = hierarchyOrder.indexOf('Sub Comandante');
            const matchedIdx = hierarchyOrder.indexOf(matchedRankName);
            if (mirrorRoleId) {
                if (!gm.roles.cache.has(mirrorRoleId))
                    toAdd.push(mirrorRoleId);
                mirroredRankApplied = matchedRankName;
            }
            else if (fallbackRoleId && matchedIdx !== -1 && subCmdIdx !== -1 && matchedIdx < subCmdIdx) {
                if (!gm.roles.cache.has(fallbackRoleId))
                    toAdd.push(fallbackRoleId);
                mirroredRankApplied = matchedRankName + ' (fallback)';
            }
        }
        for (const rid of toAdd) {
            await gm.roles.add(rid, 'Verificação Migração');
        }
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('Verificação Concluída • Migração')
            .setDescription(`Validação realizada com sucesso.\n${mirroredRankApplied ? `Patente espelhada: **${mirroredRankApplied}**` : 'Nenhuma patente espelhada aplicável.'}`)
            .setFooter({ text: 'Sistema de Verificação • Migração' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
};
