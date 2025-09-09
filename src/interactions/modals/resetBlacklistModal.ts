import { ModalSubmitInteraction, EmbedBuilder } from 'discord.js';
import { BlacklistService } from '../../services/blacklistService.ts';
import { isValidArea } from '../../constants/areas.ts';
import { loadConfig } from '../../config/index.ts';
import { logger } from '../../utils/logger.ts';
const svc = new BlacklistService();
export default {
    id: 'reset_blacklist_modal',
    async execute(interaction: ModalSubmitInteraction) {
        const parts = interaction.customId.split(':');
        const scope = parts[1];
        const typed = interaction.fields.getTextInputValue('confirm').trim().toLowerCase();
        if (typed !== 'confirmar') {
            return interaction.reply({ content: 'Confirmação incorreta. Digite exatamente "confirmar".', ephemeral: true });
        }
        await interaction.deferReply({ ephemeral: true });
        try {
            if (scope && scope !== '__all__') {
                if (!isValidArea(scope)) {
                    return interaction.editReply('Área inválida.');
                }
                await svc.resetArea(scope);
                await interaction.editReply(`Todas as blacklists ativas da área ${scope} foram marcadas como removidas.`);
            }
            else {
                await svc.resetAll();
                await interaction.editReply('Todas as blacklists ativas (todas as áreas e GERAL) foram marcadas como removidas.');
            }
            try {
                const cfg: any = loadConfig();
                const mainGuildId = cfg.mainGuildId;
                const logChannelId = '1414539287130800259';
                const client = interaction.client;
                const guild = client.guilds.cache.get(mainGuildId) || await client.guilds.fetch(mainGuildId).catch(() => null);
                if (guild) {
                    let ch: any = guild.channels.cache.get(logChannelId);
                    if (!ch)
                        ch = await guild.channels.fetch(logChannelId).catch(() => null);
                    if (ch && ch.isTextBased()) {
                        const embed = new EmbedBuilder()
                            .setColor(0xE67E22)
                            .setTitle('🧹 Reset de Blacklist')
                            .setDescription(scope && scope !== '__all__' ? `Reset executado para área **${scope}**.` : 'Reset geral de todas as blacklists ativas.')
                            .addFields({ name: 'Executor', value: `<@${interaction.user.id}>`, inline: true })
                            .setTimestamp();
                        await ch.send({ embeds: [embed] }).catch(() => { });
                    }
                }
            }
            catch (e: any) {
                logger.warn({ err: e }, 'Falha ao logar reset de blacklist');
            }
        }
        catch (err: any) {
            await interaction.editReply('Erro ao resetar blacklist: ' + (err?.message || 'desconhecido'));
        }
    }
};
