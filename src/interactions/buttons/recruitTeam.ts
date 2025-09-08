import { ButtonInteraction, ActionRowBuilder, ButtonBuilder, EmbedBuilder } from 'discord.js';
import { loadConfig } from '../../config/index.ts';
import { RECRUIT_AREAS } from '../../commands/recrutar.ts';
const cfg = loadConfig();
const LOG_CHANNEL_ID = '1414539961515900979';
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
        const roleId = areaCfg?.roleIds?.member || 'ROLE_ID_PLACEHOLDER'; // real IDs agora no config
        if (!areaCfg) {
            await interaction.editReply('Config da equipe não encontrada.');
            return;
        }
        const inicianteRole = cfg.roles?.Iniciante;
        const staffRole = cfg.roles?.staff; // 1135122929529659472
        // Atribui cargo da equipe
        if (!roleId.startsWith('ROLE_ID_') && !member.roles.cache.has(roleId)) {
            await member.roles.add(roleId).catch(() => { });
        }
        // Sempre garantir cargo Iniciante
        if (inicianteRole && !member.roles.cache.has(inicianteRole)) {
            await member.roles.add(inicianteRole).catch(() => { });
        }
        // Sempre garantir cargo Staff
        if (staffRole && !member.roles.cache.has(staffRole)) {
            await member.roles.add(staffRole).catch(() => { });
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
                .setTitle('<a:asparkles:1118602923346243615> Recrutamento Efetuado')
                .setColor(TEAM_COLORS[team] || 0x2c3e50)
                .addFields({ name: '<:branco_membros:1303749626062573610> Usuário', value: `<@${userId}>\n(${userId})`, inline: true }, { name: '<a:ccoroa_CDW:1135017799438315650> Staff', value: `<@${interaction.user.id}>\n(${interaction.user.id})`, inline: true }, { name: '<a:staff_cdw:934664526639562872> Equipe', value: `**${team.toUpperCase()}**`, inline: true })
                .setTimestamp();
            if (memberUser?.avatarURL())
                embed.setThumbnail(memberUser.avatarURL()!);
            if (roleId.startsWith('ROLE_ID_')) {
                embed.addFields({ name: '⚠️ Cargo Equipe', value: 'Cargo ainda não configurado.', inline: false });
            } else {
                embed.addFields({ name: '<a:z_estrelinha_cdw:935927437647314994> Cargos Atribuídos', value: [roleId.startsWith('ROLE_ID_') ? null : `<@&${roleId}>`, inicianteRole ? `<@&${inicianteRole}>` : null, staffRole ? `<@&${staffRole}>` : null].filter(Boolean).join(' ') || '—', inline: false });
            }
            (logChannel as any).send({ embeds: [embed] }).catch(() => { });
        }
        await interaction.editReply(`Recrutamento concluído para <@${userId}> em **${team.toUpperCase()}**.`);
    }
};
