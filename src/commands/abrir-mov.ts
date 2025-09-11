import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { loadConfig } from '../config/index.ts';
export default {
    data: new SlashCommandBuilder()
        .setName('abrir-mov')
        .setDescription('Força a reabertura da ORG-MOV'),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const cfg: any = loadConfig();
            const owners: string[] = cfg.owners || [];
            const movArea = (cfg.areas || []).find((a: any) => a.name === 'MOVCALL');
            const movLeadId = movArea?.roleIds?.lead;
            const globalMovLeadId = cfg.primaryGuildLeadershipRoles?.movcall;
            const movConfig = cfg.movOrg || {};
            const channelId = movConfig.channelId || '1338533776665350226';
            const roleId = movConfig.roleId || '1136861814328668230';
            const extraLeadRoleId = movConfig.extraLeadRoleId || '1136864678253969430';
            const openGif = movConfig.openGif || 'https://cdn.discordapp.com/attachments/1338533776665350226/1414750584602628258/org_aberto.gif';
            
            const member = interaction.member as any;
            const hasRole = (id: string) => member?.roles?.cache?.has(id);
            const allowed = owners.includes(interaction.user.id)
                            || (movLeadId && hasRole(movLeadId))
                            || hasRole(extraLeadRoleId)
                            || (globalMovLeadId && hasRole(globalMovLeadId));
            if (!allowed) {
                await interaction.editReply('Você não tem permissão para usar este comando.');
                return;
            }
            const ch: any = await interaction.client.channels.fetch(channelId).catch(() => null);
            if (!ch || !ch.isTextBased()) {
                await interaction.editReply('Canal indisponível.');
                return;
            }
            const embed = new EmbedBuilder()
                .setColor(0x2ecc71)
                .setTitle('<a:emoji_415:1282771322555994245> ORG-MOV REABERTA')
                .setImage(openGif)
                .setTimestamp();
            await ch.send({ content: `<@&${roleId}>`, embeds: [embed] });
            await interaction.editReply('ORG-MOV reaberta (manual).');
        }
        catch (e) {
            logger.warn({ e }, 'Falha abrir mov manual');
            await interaction.editReply('Erro ao enviar.');
        }
    }
};
