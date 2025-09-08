import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import { loadConfig } from '../../config/index.ts';
import { RECRUIT_AREAS } from '../../commands/recrutar.ts';
const cfg = loadConfig();
const LOG_CHANNEL_ID = cfg.channels.recruitLog || '';
const TEAM_COLORS: Record<string, number> = {
    movcall: 0x1abc9c,
    design: 0xe67e22,
    jornalismo: 0x9b59b6,
    recrutamento: 0x3498db,
    eventos: 0xf1c40f
};
export default {
    id: 'recruit_team',
    async execute(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const parts = interaction.customId.split(':');
        const team = parts[1].toLowerCase();
        const userId = parts[2];
        if (!RECRUIT_AREAS.find(a => a.key === team)) {
            await interaction.editReply('Equipe inválida.');
            return;
        }
        const member = await interaction.guild?.members.fetch(userId).catch(() => null);
        if (!member) {
            await interaction.editReply('Usuário não encontrado no servidor.');
            return;
        }
        const areaCfg = cfg.areas.find(a => a.name.toLowerCase() === team);
        const roleId = areaCfg?.roleIds?.member || 'ROLE_ID_PLACEHOLDER';
        if (!roleId.startsWith('ROLE_ID_')) {
            if (!member.roles.cache.has(roleId)) {
                await member.roles.add(roleId).catch(() => { });
            }
        }
        try {
            if (interaction.message.editable) {
                const rows = interaction.message.components.map((r: any) => {
                    const row = new ActionRowBuilder<ButtonBuilder>();
                    (r.components || []).forEach((c: any) => {
                        if (c?.data?.custom_id) {
                            const b = ButtonBuilder.from(c as any);
                            b.setDisabled(true);
                            row.addComponents(b);
                        }
                    });
                    return row;
                });
                await interaction.message.edit({ components: rows }).catch(() => { });
            }
        }
        catch { }
        const logChannel = LOG_CHANNEL_ID ? await interaction.client.channels.fetch(LOG_CHANNEL_ID).catch(() => null) : null;
        if (logChannel && logChannel.isTextBased()) {
            const memberUser = member.user;
            const embed = new EmbedBuilder()
                .setTitle('🧩 Recrutamento Efetuado')
                .setColor(TEAM_COLORS[team] || 0x2c3e50)
                .addFields({ name: '👤 Usuário', value: `<@${userId}>\n(${userId})`, inline: true }, { name: '🛠️ Staff', value: `<@${interaction.user.id}>\n(${interaction.user.id})`, inline: true }, { name: '🏷️ Equipe', value: `**${team.toUpperCase()}**`, inline: true })
                .setTimestamp();
            if (memberUser?.avatarURL())
                embed.setThumbnail(memberUser.avatarURL()!);
            if (roleId.startsWith('ROLE_ID_')) {
                embed.addFields({ name: '⚠️ Cargo', value: 'Cargo ainda não configurado.', inline: false });
            }
            else {
                embed.addFields({ name: '✅ Cargo', value: 'Cargo atribuído com sucesso.', inline: false });
            }
            (logChannel as any).send({ embeds: [embed] }).catch(() => { });
        }
        await interaction.editReply(`Recrutamento concluído para <@${userId}> em **${team.toUpperCase()}**.`);
    }
};
