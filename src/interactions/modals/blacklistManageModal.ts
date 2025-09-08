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
        const areaInputOriginal = interaction.fields.getTextInputValue('area').trim();
        const areaInput = areaInputOriginal.toLowerCase();
        const allowedAreas = [
            'Mov Call',
            'Recrutamento',
            'Design',
            'Jornalismo',
            'Suporte',
            'Eventos'
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
        const areaRaw = areaCanonical.toUpperCase();
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
