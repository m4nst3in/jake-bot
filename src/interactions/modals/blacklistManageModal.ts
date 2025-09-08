import { ModalSubmitInteraction, EmbedBuilder, TextBasedChannel, GuildMember } from 'discord.js';
import { BlacklistService } from '../../services/blacklistService.ts';
import { loadConfig } from '../../config/index.ts';
import { isOwner } from '../../utils/permissions.ts';
const svc = new BlacklistService();
export default {
    id: 'bl_manage_modal',
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
    const member = interaction.member as GuildMember | null;
    if (!isOwner(member) && !interaction.memberPermissions?.has('ManageGuild')) {
            await interaction.editReply('Sem permissão.');
            return;
        }
        const targetId = interaction.customId.split(':')[1];
        const acao = interaction.fields.getTextInputValue('acao').trim().toLowerCase();
        const areaInputOriginal = interaction.fields.getTextInputValue('area').trim();
        const areaInput = areaInputOriginal.toLowerCase();
        const allowedAreas = [
            'Mov Call',
            'Recrutamento',
            'Design',
            'Jornalismo',
            'Suporte',
            'Eventos',
            'Geral'
        ];
        const normalize = (s: string) => s.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z]/g, '');
        const levenshtein = (a: string, b: string) => {
            if (a === b)
                return 0;
            const m = a.length, n = b.length;
            if (!m)
                return n;
            if (!n)
                return m;
            const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1));
            for (let i = 0; i <= m; i++)
                dp[i][0] = i;
            for (let j = 0; j <= n; j++)
                dp[0][j] = j;
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
                }
            }
            return dp[m][n];
        };
        const normalizedInput = normalize(areaInputOriginal);
        let bestMatch: {
            area: string;
            distance: number;
            norm: string;
        } | null = null;
        for (const area of allowedAreas) {
            const norm = normalize(area);
            const dist = levenshtein(normalizedInput, norm);
            if (!bestMatch || dist < bestMatch.distance) {
                bestMatch = { area, distance: dist, norm };
            }
            if (normalizedInput.length >= 4 && norm.startsWith(normalizedInput)) {
                bestMatch = { area, distance: 0, norm };
                break;
            }
        }
        let areaCanonical: string | null = null;
        if (bestMatch) {
            const maxLen = Math.max(bestMatch.norm.length, normalizedInput.length);
            const ratio = bestMatch.distance / maxLen;
            if (bestMatch.distance === 0 ||
                bestMatch.distance <= 2 ||
                (maxLen >= 8 && ratio <= 0.25)) {
                areaCanonical = bestMatch.area;
            }
        }
        if (!areaCanonical) {
            const sugestao = bestMatch && bestMatch.distance <= 4 ? ` Você quis dizer: ${bestMatch.area}?` : '';
            await interaction.editReply(`Área inválida. Use apenas: ${allowedAreas.join(', ')}.${sugestao}`);
            return;
        }
    const areaRaw = areaCanonical.toUpperCase(); // inclui GERAL para aplicar em todas as áreas
        const motivo = interaction.fields.getTextInputValue('motivo')?.trim();
        if (!['adicionar', 'add', 'remover', 'remove', 'del', 'delete'].includes(acao)) {
            await interaction.editReply('Ação inválida. Use adicionar ou remover.');
            return;
        }
        if (['adicionar', 'add'].includes(acao) && !motivo) {
            await interaction.editReply('Motivo obrigatório para adicionar.');
            return;
        }
        // Restrição especial: somente determinados usuários / cargos podem ADICIONAR blacklist GERAL
        if (areaRaw === 'GERAL' && ['adicionar','add'].includes(acao)) {
            const cfg: any = loadConfig();
            const owners: string[] = Array.isArray(cfg.owners) ? cfg.owners : [];
            const explicitUsers = ['1016542932284747836']; // adicional além dos owners
            const allowedUserIds = new Set<string>([...owners, ...explicitUsers, '418824536570593280']);
            const allowedRoleIds = ['1153690317262950400','1411223951350435961'];
            const gm = interaction.member as GuildMember | null;
            const hasRole = !!gm?.roles?.cache?.some(r => allowedRoleIds.includes(r.id));
            if (!allowedUserIds.has(interaction.user.id) && !hasRole) {
                await interaction.editReply('Sem permissão para adicionar blacklist GERAL.');
                return;
            }
        }
        try {
            let userObj = interaction.client.users.cache.get(targetId);
            if (!userObj) {
                try {
                    userObj = await interaction.client.users.fetch(targetId);
                }
                catch { }
            }
            const rootCfg: any = loadConfig();
            const mainGuildId = rootCfg.mainGuildId;
            const mainLogChannelId = '1414539287130800259';
            const sendToMainLog = async (embed: EmbedBuilder) => {
                try {
                    const client = interaction.client;
                    const mainGuild = client.guilds.cache.get(mainGuildId) || await client.guilds.fetch(mainGuildId).catch(()=>null);
                    if (!mainGuild) return;
                    let ch = mainGuild.channels.cache.get(mainLogChannelId) as TextBasedChannel | undefined;
                    if (!ch) {
                        const fetched = await mainGuild.channels.fetch(mainLogChannelId).catch(()=>null);
                        if (fetched && fetched.isTextBased()) ch = fetched as TextBasedChannel;
                    }
                    if (ch && 'send' in ch) await (ch as any).send({ embeds: [embed] });
                } catch {}
            };
            if (['adicionar', 'add'].includes(acao)) {
                await svc.add(targetId, motivo!, areaRaw, interaction.user.id);
                const ativos = await (svc as any).listUser(targetId) as any[];
                const embed = new EmbedBuilder()
                    .setColor(0xC0392B)
                    .setTitle('<a:z_proibido_cdw:951509668159692871> Blacklist • Adicionada')
                    .setDescription(`Novo registro de blacklist aplicado.`)
                    .addFields(
                        { name: '<:branco_membros:1303749626062573610> Usuário', value: `<@${targetId}>\n\`${targetId}\``, inline: true },
                        { name: '<:white_peace:988012499133681674> Staff', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '<:x_hype:1283509028995207241> Área', value: `**${areaRaw}**`, inline: false },
                        { name: '<a:emoji_417:1282771719400067173> Motivo', value: motivo!.slice(0, 1000) },
                        { name: '<a:zyellow_aviso_sz_cdw:934691135073439845> Blacklists ativas', value: `${ativos.length}`, inline: true }
                    )
                    .setFooter({ text: 'Gerenciado via painel de blacklist' })
                    .setTimestamp();
                if (userObj?.avatarURL())
                    embed.setThumbnail(userObj.avatarURL()!);
                await interaction.editReply({ embeds: [embed] });
                await sendToMainLog(embed);
            }
            else {
                await svc.remove(targetId, areaRaw, interaction.user.id);
                const ativos = await (svc as any).listUser(targetId) as any[];
                const embed = new EmbedBuilder()
                    .setColor(0x27AE60)
                    .setTitle('<a:z_proibido_cdw:951509668159692871> Blacklist • Removida')
                    .setDescription('Registro de blacklist removido com sucesso.')
                    .addFields(
                        { name: '<:branco_membros:1303749626062573610> Usuário', value: `<@${targetId}>\n\`${targetId}\``, inline: true },
                        { name: '<a:z_estrelinha_cdw:935927437647314994> Staff', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '<:x_hype:1283509028995207241> Área', value: `**${areaRaw}**`, inline: false },
                        { name: '<a:zyellow_aviso_sz_cdw:934691135073439845> Blacklists restantes', value: `${ativos.length}`, inline: true }
                    )
                    .setFooter({ text: 'Gerenciado via painel de blacklist' })
                    .setTimestamp();
                if (userObj?.avatarURL())
                    embed.setThumbnail(userObj.avatarURL()!);
                await interaction.editReply({ embeds: [embed] });
                await sendToMainLog(embed);
            }
        }
        catch (e: any) {
            await interaction.editReply(`Erro ao processar: ${e.message || e}`);
        }
    }
};
