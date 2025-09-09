import { Guild, EmbedBuilder, TextBasedChannel, ActionRowBuilder, ButtonBuilder } from 'discord.js';
import { logger } from './logger.ts';
import { loadConfig } from '../config/index.ts';
interface RppLogPayload {
    id?: number | string;
    userId: string;
    moderatorId?: string;
    status?: string;
    reason?: string;
    returnDate?: string;
    createdAt?: string;
    processedAt?: string;
    area?: string;
    startedAt?: string;
    restoredRoles?: string[];
}
function daysUntil(dateStr?: string) {
    if (!dateStr)
        return undefined;
    let iso = dateStr;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [d, m, y] = dateStr.split('/');
        iso = `${y}-${m}-${d}`;
    }
    const target = new Date(iso + 'T00:00:00Z');
    if (isNaN(target.getTime()))
        return undefined;
    const now = new Date();
    return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}
function mapType(type: string, snow: string) {
    switch (type) {
        case 'criado': return { title: `${snow} RPP Criado`, color: 0x1f8b4c };
        case 'solicitado': return { title: `${snow} RPP Solicitado`, color: 0x1f8b4c };
        case 'ativado': return { title: `${snow} RPP Iniciado`, color: 0x4b9cd3 };
        case 'removido': return { title: `${snow} RPP Encerrado`, color: 0x95a5a6 };
        default: return { title: `${snow} RPP`, color: 0xcccccc };
    }
}
export async function sendRppLog(guild: Guild | null | undefined, type: string, payload: RppLogPayload) {
    if (!guild)
        return;
    const client = guild.client;
    const rootCfg: any = loadConfig();
    const allRppGuildEntries: [
        string,
        any
    ][] = Object.entries(rootCfg.rpp?.guilds || {});
    if (!allRppGuildEntries.length)
        return;
    const targetGuilds: Guild[] = [];
    for (const [gId, cfg] of allRppGuildEntries) {
        const g = client.guilds.cache.get(gId);
        if (!g)
            continue;
        const member = await g.members.fetch(payload.userId).catch(() => null);
        if (member)
            targetGuilds.push(g);
    }
    if (!targetGuilds.length)
        return;
    const snow = rootCfg.emojis?.rppSnowflake || '<a:snowflake:placeholder>';
    const dot = rootCfg.emojis?.dot || '•';
    const meta = mapType(type, snow);
    let days: number | undefined;
    if (payload.returnDate) {
        const m = payload.returnDate.match(/^(\d+) dia/);
        if (m)
            days = parseInt(m[1], 10);
        else
            days = daysUntil(payload.returnDate);
    }
    const reasonRaw = (payload.reason || '').trim();
    const reason = reasonRaw ? (reasonRaw.length > 800 ? reasonRaw.slice(0, 800) + '…' : reasonRaw) : undefined;
    function mapStatus(s?: string) {
        if (!s)
            return undefined;
        const base = s.toLowerCase();
        if (base === 'ativo' || base === 'accepted')
            return 'Ativo';
        if (base === 'removido' || base === 'removed')
            return 'Encerrado';
        if (base === 'pendente' || base === 'pending')
            return 'Pendente';
        if (base === 'negado' || base === 'rejected')
            return 'Negado';
        return base.charAt(0).toUpperCase() + base.slice(1);
    }
    const parts: string[] = [];
    parts.push(`${dot} **Usuário**\n<@${payload.userId}> (${payload.userId})`);
    if (payload.moderatorId)
        parts.push(`${dot} **Staff**\n<@${payload.moderatorId}> (${payload.moderatorId})`);
    const friendlyStatus = mapStatus(payload.status);
    if (friendlyStatus)
        parts.push(`${dot} **Status**\n${friendlyStatus}`);
    if (reason)
        parts.push(`${dot} **Motivo**\n${reason}`);
    if (payload.area)
        parts.push(`${dot} **Área**\n${payload.area}`);
    if (type === 'removido' && payload.startedAt)
        parts.push(`${dot} **Início do RPP**\n${payload.startedAt}`);
    if (payload.returnDate) {
        if (/^\d+ dia/.test(payload.returnDate))
            parts.push(`${dot} **Ausência**\n${payload.returnDate}`);
        else
            parts.push(`${dot} **Retorno Previsto**\n${payload.returnDate}${days !== undefined ? ` (em ${days} dia${Math.abs(days) === 1 ? '' : 's'})` : ''}`);
    }
    let components: any[] | undefined;
    if (type === 'solicitado' && payload.id !== undefined) {
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`rpp_accept:${payload.id}`).setLabel('Aceitar').setStyle(3).setEmoji(rootCfg.emojis?.rppAccept || ''), new ButtonBuilder().setCustomId(`rpp_reject:${payload.id}`).setLabel('Recusar').setStyle(4).setEmoji(rootCfg.emojis?.rppReject || ''));
        components = [row];
    }
    async function resolveSnapshotRoles(userId: string) {
        try {
            const svc = await import('../services/rppService.ts');
            const store = (svc as any).inMemorySnapshots || {};
            const snap = store[userId];
            if (snap?.roles?.length)
                return snap.roles as string[];
        }
        catch { }
        try {
            const repoMod = await import('../repositories/rppSnapshotRepository.ts');
            const Repo = (repoMod as any).RppSnapshotRepository;
            const repo = new Repo();
            const rec = await repo.get(userId);
            return (rec?.roles as string[]) || [];
        }
        catch {
            return [];
        }
    }
    for (const g of targetGuilds) {
        const rppCfg = rootCfg.rpp?.guilds?.[g.id];
        if (!rppCfg)
            continue;
        const reviewChannelId = rppCfg.review;
        const logChannelId = rppCfg.log;
        const useReview = type === 'solicitado';
        const primaryChannelId = useReview ? reviewChannelId : logChannelId;
        let channel = g.channels.cache.get(primaryChannelId) as TextBasedChannel | undefined;
        if (!channel) {
            try {
                const fetched = await g.channels.fetch(primaryChannelId).catch(() => null);
                if (fetched && fetched.isTextBased())
                    channel = fetched as TextBasedChannel;
            }
            catch { }
        }
        if (!channel || !('send' in channel)) {
            logger.warn({ channelId: primaryChannelId, type }, 'RPP log: canal não encontrado ou inválido');
            if (type === 'ativado') {
                let fb = g.channels.cache.get(reviewChannelId) as TextBasedChannel | undefined;
                if (!fb) {
                    try {
                        const fetchedFb = await g.channels.fetch(reviewChannelId).catch(() => null);
                        if (fetchedFb && fetchedFb.isTextBased())
                            fb = fetchedFb as TextBasedChannel;
                    }
                    catch { }
                }
                if (fb && ('send' in fb))
                    channel = fb;
                else
                    continue;
            }
            else
                continue;
        }
        let description = parts.join('\n\n');
        let contentForArea: string | undefined;
        if (type === 'ativado') {
            const removedRoles = await resolveSnapshotRoles(payload.userId);
            if (removedRoles.length)
                description += `\n\n${dot} **Cargos Removidos**\n${removedRoles.map((r: string) => `<@&${r}>`).join(' ')}`;
        }
        if (type === 'removido') {
            const all = await resolveSnapshotRoles(payload.userId);
            const extras = (rootCfg as any).rppExtras || {};
            const permExclude = extras.permExclude || [];
            const restored = all.filter((r: string) => !permExclude.includes(r));
            if (restored.length)
                description += `\n\n${dot} **Cargos Restaurados**\n${restored.map((r: string) => `<@&${r}>`).join(' ')}`;
        }
        if (type === 'solicitado') {
            const areaCfg = (rootCfg.areas || []).find((a: any) => a.guildId === g.id);
            if (areaCfg?.roleIds?.lead)
                contentForArea = `<@&${areaCfg.roleIds.lead}>`;
            else if (rootCfg.support?.guildId === g.id && rootCfg.support?.roles?.supervisao)
                contentForArea = `<@&${rootCfg.support.roles.supervisao}>`;
        }
        const embed = new EmbedBuilder().setTitle(meta.title).setDescription(description).setColor(meta.color);
        try {
            const member = await g.members.fetch(payload.userId).catch(() => null);
            if (member?.user?.avatarURL())
                embed.setThumbnail(member.user.avatarURL()!);
        }
        catch { }
        try {
            await (channel as any).send({ content: contentForArea, embeds: [embed], components });
        }
        catch { }
    }
    if (['ativado', 'removido'].includes(type)) {
        const mainGuildId = rootCfg.mainGuildId;
        const extras = (rootCfg as any).rppExtras || {};
    const mainLogChannelId = extras.mainLogChannelId;
        const mainGuild = guild?.client.guilds.cache.get(mainGuildId) || await guild?.client.guilds.fetch(mainGuildId).catch(() => null);
        if (mainGuild) {
            let channel = mainGuild.channels.cache.get(mainLogChannelId) as TextBasedChannel | undefined;
            if (!channel) {
                try {
                    const fetched = await mainGuild.channels.fetch(mainLogChannelId).catch(() => null);
                    if (fetched && fetched.isTextBased())
                        channel = fetched as TextBasedChannel;
                }
                catch { }
            }
            if (channel && ('send' in channel)) {
                let description = parts.join('\n\n');
                let content: string | undefined;
                if (type === 'ativado') {
                    const removedRoles = await resolveSnapshotRoles(payload.userId);
                    if (removedRoles.length)
                        description += `\n\n${dot} **Cargos Removidos**\n${removedRoles.map((r: string) => `<@&${r}>`).join(' ')}`;
                    const membershipToLeadership: Record<string, string> = extras.membershipToLeadership || {};
                    const mentioned = new Set<string>();
                    const areaGuildIds = Object.keys(rootCfg.rpp?.guilds || {}).filter(id => id !== mainGuildId);
                    for (const gId of areaGuildIds) {
                        let areaGuild = guild.client.guilds.cache.get(gId);
                        if (!areaGuild)
                            areaGuild = await guild.client.guilds.fetch(gId).catch(() => null) as any;
                        if (!areaGuild)
                            continue;
                        const areaMember = await areaGuild.members.fetch(payload.userId).catch(() => null);
                        if (!areaMember)
                            continue;
                        for (const [memberRoleId, leadRoleId] of Object.entries(membershipToLeadership)) {
                            if (areaMember.roles.cache.has(memberRoleId))
                                mentioned.add(leadRoleId);
                        }
                    }
                    if (mentioned.size)
                        content = Array.from(mentioned).map(id => `<@&${id}>`).join(' ');
                }
                else if (type === 'removido') {
                    const all = await resolveSnapshotRoles(payload.userId);
                    const permExclude = (extras.permExclude || []);
                    const restored = all.filter((r: string) => !permExclude.includes(r));
                    if (restored.length)
                        description += `\n\n${dot} **Cargos Restaurados**\n${restored.map((r: string) => `<@&${r}>`).join(' ')}`;
                }
                const embed = new EmbedBuilder().setTitle(meta.title).setDescription(description).setColor(meta.color).setFooter({ text: 'Log (principal)' });
                try {
                    const member = await mainGuild.members.fetch(payload.userId).catch(() => null);
                    if (member?.user?.avatarURL())
                        embed.setThumbnail(member.user.avatarURL()!);
                }
                catch { }
                try {
                    const msg = await (channel as any).send({ content, embeds: [embed] });
                    await msg.react('<a:z_blue_Verificado:1037734218169589840>').catch(() => { });
                }
                catch { }
            }
        }
    }
}
