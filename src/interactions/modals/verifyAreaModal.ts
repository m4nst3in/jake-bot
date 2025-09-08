import { ModalSubmitInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { resolvePrimaryGuildId, loadConfig } from '../../config/index.ts';
const AREA_GUILD_ASSIGN: Record<string, {
    area: string;
    areaRole: string;
    waitingRole?: string;
    upYes: string;
    upNo: string;
}> = {
    '1190390194533318706': { area: 'MOVCALL', areaRole: '1190390194533318715', waitingRole: '1190390194533318712', upYes: '1190390194533318714', upNo: '1190390194533318713' },
    '1180721287476289596': { area: 'RECRUTAMENTO', areaRole: '1180871634631020594', waitingRole: '1180871603249217547', upYes: '1180871635662819498', upNo: '1180871637491523626' },
    '1190515971035774996': { area: 'SUPORTE', areaRole: '1190515971069321238', waitingRole: '1195189431435542538', upYes: '1190515971069321236', upNo: '1190515971035775005' },
    '1405418716258111580': { area: 'EVENTOS', areaRole: '1283205107021774918', waitingRole: '1283205107617632336', upYes: '1283205780983648278', upNo: '1283205781831024640' },
    '1183909149784952902': { area: 'DESIGN', areaRole: '1183909149784952908', upYes: '1183909149784952907', upNo: '1183909149784952906' },
    '1224414082866745405': { area: 'JORNALISMO', areaRole: '1224414082866745411', upYes: '1224414082866745410', upNo: '1224414082866745409' }
};
export default {
    id: 'verify_area_modal',
    async execute(interaction: ModalSubmitInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const assign = AREA_GUILD_ASSIGN[interaction.guildId!];
        if (!assign) {
            await interaction.editReply('Configuração desta área não encontrada.');
            return;
        }
        const primaryGuildId = resolvePrimaryGuildId();
        if (!primaryGuildId) {
            await interaction.editReply('Configuração inválida (guild principal ausente).');
            return;
        }
        if (interaction.guildId === primaryGuildId) {
            await interaction.editReply('Use este formulário apenas em servidores de área.');
            return;
        }
        const primaryGuild = await interaction.client.guilds.fetch(primaryGuildId).catch(() => null);
        if (!primaryGuild) {
            await interaction.editReply('Não consegui acessar a guild principal para validação.');
            return;
        }
        const primaryMember = await primaryGuild.members.fetch(interaction.user.id).catch(() => null);
        if (!primaryMember) {
            await interaction.editReply('Você não está no servidor principal. Entre nele antes.');
            return;
        }
        const MAIN_AREA_ROLES: Record<string, {
            area: string;
        }> = {
            '1136861840421425284': { area: 'SUPORTE' },
            '1170196352114901052': { area: 'EVENTOS' },
            '1136861814328668230': { area: 'MOVCALL' },
            '1136868804677357608': { area: 'RECRUTAMENTO' },
            '1136861844540227624': { area: 'DESIGN' },
            '1247967720427884587': { area: 'JORNALISMO' }
        };
        const hasRequired = primaryMember.roles.cache.some(r => MAIN_AREA_ROLES[r.id]?.area === assign.area);
        if (!hasRequired) {
            await interaction.editReply(`Você não possui o cargo principal da área **${assign.area}** no servidor principal.`);
            return;
        }
        const answerRaw = interaction.fields.getTextInputValue('upa').trim().toLowerCase();
        if (!['sim', 'não', 'nao'].includes(answerRaw)) {
            await interaction.editReply('Resposta inválida. Digite apenas Sim ou Não.');
            return;
        }
        const up = answerRaw.startsWith('s');
        const toAdd: string[] = [assign.areaRole, up ? assign.upYes : assign.upNo];
        const toRemove: string[] = [];
        if (assign.waitingRole)
            toRemove.push(assign.waitingRole);
        toRemove.push(up ? assign.upNo : assign.upYes);
        const gm = interaction.member as GuildMember;
        if (!gm || !gm.roles) {
            await interaction.editReply('Não foi possível acessar seus cargos para atualização.');
            return;
        }
        for (const r of toAdd) {
            if (!(gm.roles as any).cache.has(r)) {
                await (gm.roles as any).add(r, 'Verificação de área');
            }
        }
        for (const r of toRemove) {
            if ((gm.roles as any).cache.has(r)) {
                await (gm.roles as any).remove(r, 'Limpando cargos antigos após verificação');
            }
        }
        const cfg = loadConfig();
        const mainRanks = cfg.roles || {};
        const mirrorMap = cfg.staffRankMirrors?.[interaction.guildId!] || {};
        let mirroredRankName: string | null = null;
        for (const [rankName, mainRoleId] of Object.entries(mainRanks)) {
            if (rankName === 'staff')
                continue;
            if (primaryMember.roles.cache.has(mainRoleId!)) {
                const areaRankId = mirrorMap[rankName];
                if (areaRankId) {
                    if (!(gm.roles as any).cache.has(areaRankId)) {
                        await (gm.roles as any).add(areaRankId, 'Espelhamento de patente staff');
                    }
                    mirroredRankName = rankName;
                }
                break;
            }
        }
        const embed = new EmbedBuilder()
            .setColor(0x2ecc71)
            .setTitle('Verificação Concluída')
            .setDescription(`Área: **${assign.area}**\nStatus de progressão: **${up ? 'Eu Upo' : 'Não Upo'}**${mirroredRankName ? `\nPatente espelhada: **${mirroredRankName}**` : ''}`)
            .setFooter({ text: 'Sistema de Verificação' })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });
    }
};
