import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember } from 'discord.js';
import { PointsService } from '../services/pointsService.ts';
import { PointRepository } from '../repositories/pointRepository.ts';
import { loadConfig } from '../config/index.ts';
import { BlacklistRepository } from '../repositories/blacklistRepository.ts';
import { OccurrenceRepository } from '../repositories/occurrenceRepository.ts';
import { RPPRepository } from '../repositories/rppRepository.ts';
import { getMemberLeaderAreas, hasCrossGuildLeadership, isOwner } from '../utils/permissions.ts';
import { StaffReportService } from '../services/staffReportService.ts';
export default {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Mostra o perfil de pontos de um usuário')
        .addUserOption(o => o.setName('user').setDescription('Usuário alvo').setRequired(false)),
    async execute(interaction: ChatInputCommandInteraction) {
        await interaction.deferReply({ ephemeral: true });
        // Permission gate: only owners and leadership can access /perfil
        const reqMember = interaction.member as GuildMember | null;
        const owner = isOwner(reqMember);
        let isLeader = getMemberLeaderAreas(reqMember).length > 0;
        if (!isLeader && reqMember) {
            try { isLeader = await hasCrossGuildLeadership(interaction.client, reqMember.id); } catch {}
        }
        if (!owner && !isLeader) {
            await interaction.editReply('Sem permissão para usar este comando. Tá louco?');
            return;
        }
        const target = interaction.options.getUser('user') || interaction.user;
        const svc = new PointsService();
        const repo = new PointRepository();
        const blacklistRepo = new BlacklistRepository();
        const occRepo = new OccurrenceRepository();
        const rppRepo = new RPPRepository();
        const cfg: any = loadConfig();
        const profile = await svc.getUserProfile(target.id);
        const positionsPromise = Promise.all(profile.areas.map(a => (repo as any).getAreaPosition(target.id, a.area).catch(() => null)));
        const activeBlacklistPromise = blacklistRepo.listUserActive(target.id).catch(() => []);
        const occCountPromise = occRepo.countForUser(target.id).catch(() => 0);
        const rppActivePromise = rppRepo.findActiveByUser(target.id).catch(() => null);
        const [positions, activeBlacklist, occCount, rppActive] = await Promise.all([positionsPromise, activeBlacklistPromise, occCountPromise, rppActivePromise]);
        let withPos = profile.areas.map((a, i) => ({ ...a, pos: positions[i] }));
        let leaderAreas: string[] = [];
        try {
            const cfgAreas: any[] = cfg.areas || [];
            const client = interaction.client;
            for (const a of cfgAreas) {
                if (!a.guildId || !a.roleIds?.lead)
                    continue;
                try {
                    const g = client.guilds.cache.get(a.guildId) || await client.guilds.fetch(a.guildId);
                    const m = await g.members.fetch(target.id).catch(() => null);
                    if (m && m.roles.cache.has(a.roleIds.lead)) {
                        leaderAreas.push(a.name);
                    }
                }
                catch { }
            }
        }
        catch { }
        leaderAreas = [...new Set(leaderAreas)].sort((a, b) => a.localeCompare(b));
        const blacklistBadges = activeBlacklist.length ? activeBlacklist.map((b: any) => b.area_or_global || 'GLOBAL').join(', ') : '';
        
        // Verificar situação disciplinar (advertências) no servidor principal
        let warningBadges = '';
        try {
            const mainGuild = interaction.client.guilds.cache.get(cfg.mainGuildId);
            if (mainGuild) {
                const mainMember = await mainGuild.members.fetch(target.id).catch(() => null);
                if (mainMember) {
                    const warningRoles = cfg.warningRoles || {};
                    const userWarnings: string[] = [];
                    
                    for (const [warningName, roleId] of Object.entries(warningRoles)) {
                        if (mainMember.roles.cache.has(String(roleId))) {
                            const warningDisplay = warningName.replace('advertencia', 'Advertência ');
                            userWarnings.push(warningDisplay);
                        }
                    }
                    
                    if (userWarnings.length > 0) {
                        warningBadges = userWarnings.join(', ');
                    }
                }
            }
        } catch { }
        try {
            const cfgAreas: any[] = cfg.areas || [];
            const client = interaction.client;
            for (const a of cfgAreas) {
                if (!a.guildId || !a.roleIds?.member)
                    continue;
                try {
                    const g = client.guilds.cache.get(a.guildId) || await client.guilds.fetch(a.guildId);
                    const m = await g.members.fetch(target.id).catch(() => null);
                    if (m && m.roles.cache.has(a.roleIds.member)) {
                        if (!withPos.find(x => x.area.toLowerCase() === a.name.toLowerCase())) {
                            withPos.push({ area: a.name, points: 0, reports: 0, shifts: 0, pos: null });
                        }
                    }
                }
                catch { }
            }
        }
        catch { }
        withPos.sort((a: any, b: any) => (b.points - a.points) || a.area.localeCompare(b.area));
        const totalReports = withPos.reduce((s, a) => s + (a.reports || 0), 0);
        const totalShifts = withPos.reduce((s, a) => s + (a.shifts || 0), 0);
        const descLines: string[] = [];
        if (withPos.length) {
            for (const a of withPos) {
                const extra: string[] = [];
                if (a.reports)
                    extra.push(`🧾 ${a.reports} rel.`);
                if (a.shifts)
                    extra.push(`🕒 ${a.shifts} plant.`);
                const posTxt = (a.pos && a.points > 0) ? `#${a.pos}` : '-';
                descLines.push(`• **${a.area}** ${posTxt} — **${a.points}** pts${extra.length ? ' • ' + extra.join(' • ') : ''}`);
            }
        }
        else {
            descLines.push('Nenhuma área encontrada.');
        }
        const headerBadges: string[] = [];
        if (leaderAreas.length)
            headerBadges.push(`👑 Liderança: ${leaderAreas.join(', ')}`);
        if (blacklistBadges)
            headerBadges.push(`⛔ Blacklist: ${blacklistBadges}`);
        if (warningBadges)
            headerBadges.push(`⚠️ Situação Disciplinar: ${warningBadges}`);
        if (rppActive)
            headerBadges.push('🧪 RPP Ativo');
        if (occCount)
            headerBadges.push(`📂 Ocorrências: ${occCount}`);
        const header = headerBadges.length ? headerBadges.join(' • ') : 'Nenhuma restrição ou liderança registrada.';
        let blacklistDetails = '';
        if (activeBlacklist.length) {
            blacklistDetails = activeBlacklist.slice(0, 3).map((b: any) => `• ${b.area_or_global || 'GLOBAL'}: ${b.reason || 'Sem motivo'}`).join('\n');
            if (activeBlacklist.length > 3)
                blacklistDetails += `\n… (+${activeBlacklist.length - 3})`;
        }
        const sections: string[] = [header, descLines.join('\n')];
        if (blacklistDetails)
            sections.push(`__Blacklist__\n${blacklistDetails}`);
        if (occCount)
            sections.push(`📂 Ocorrências: **${occCount}**`);
        const desc = sections.filter(Boolean).join('\n\n');
        const embed = new EmbedBuilder()
            .setTitle(`Perfil de ${target.username || target.tag || target.id}`)
            .setDescription(desc)
            .setFooter({ text: `Total: ${profile.total} pts • Relatórios: ${totalReports} • Plantões: ${totalShifts} • ID: ${target.id}`, iconURL: interaction.guild?.iconURL() || undefined });
        try {
            if (interaction.guildId) {
                const areas = (cfg.areas || []);
                const guildArea = areas.find((a: any) => a.guildId === interaction.guildId);
                if (guildArea) {
                    const name = guildArea.name.toUpperCase();
                    const colorMap: Record<string, number> = {
                        'SUPORTE': 0xFFFFFF,
                        'DESIGN': 0xE67E22,
                        'JORNALISMO': 0xFFB6ED,
                        'MOVCALL': 0x8B0000,
                    };
                    if (colorMap[name])
                        embed.setColor(colorMap[name]);
                }
                else {
                    embed.setColor(0x5865F2);
                }
            }
        }
        catch {
            embed.setColor(0x5865F2);
        }
        const isStaff = profile.total > 0 || leaderAreas.length > 0 || withPos.some(a => a.reports > 0 || a.shifts > 0);
        if (isStaff) {
            const staffReportService = new StaffReportService();
            const summaryEmbed = await staffReportService.generateSummaryEmbed(target.id, target);
            const navigationButtons = staffReportService.generateNavigationButtons(target.id, 'summary');
            await interaction.editReply({
                embeds: [summaryEmbed],
                components: [navigationButtons]
            });
        }
        else {
            await interaction.editReply({ embeds: [embed] });
        }
    }
};
