import { GuildMember, Guild, EmbedBuilder } from 'discord.js';
import { loadConfig } from '../config/index.ts';
import { logger } from './logger.ts';
import fs from 'node:fs';
import path from 'node:path';

interface PunishmentConfig {
    version: number;
    punishmentTypes: Record<string, any>;
    punishmentCategories: Record<string, any>;
    supportInfo: any;
}

interface PunishmentRecord {
    id: string;
    userId: string;
    executorId: string;
    punishmentType: string;
    reason: string;
    duration?: number;
    durationType?: string;
    appliedAt: number;
    expiresAt?: number;
    active: boolean;
    guildId: string;
}

export function loadPunishmentConfig(): PunishmentConfig {
    try {
        const configPath = path.join(process.cwd(), 'src', 'config', 'punicoes.json');
        const data = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        logger.error({ error }, 'Erro ao carregar configuração de punições');
        throw new Error('Falha ao carregar configuração de punições');
    }
}

export function hasPermissionToPunish(member: GuildMember, punishmentType: string): boolean {
    const config = loadConfig() as any;
    
    // Owners sempre podem punir
    if (config.owners && config.owners.includes(member.id)) {
        return true;
    }

    // Full access sempre pode punir
    const fullAccessRole = config.fullAccessRoleId;
    if (fullAccessRole && member.roles.cache.has(fullAccessRole)) {
        return true;
    }

    // Liderança geral sempre pode punir
    const leaderRole = config.protectionRoles?.leaderGeneral;
    if (leaderRole && member.roles.cache.has(leaderRole)) {
        return true;
    }

    // Verificar hierarquia para permissões específicas
    const hierarchyOrder = config.hierarchyOrder || [];
    const roles = config.roles || {};
    
    // Encontrar a patente mais alta do usuário
    let highestRankIndex = -1;
    for (const [rankName, roleId] of Object.entries(roles)) {
        if (member.roles.cache.has(roleId as string)) {
            const rankIndex = hierarchyOrder.indexOf(rankName);
            if (rankIndex > highestRankIndex) {
                highestRankIndex = rankIndex;
            }
        }
    }

    // Cabo ou superior pode aplicar mute (call/chat)
    const caboIndex = hierarchyOrder.indexOf('Cabo');
    if (highestRankIndex >= caboIndex && (punishmentType === 'mute_voice' || punishmentType === 'mute_text')) {
        return true;
    }

    // Liderança de área pode aplicar castigo e ban
    const areaLeaderRoles = Object.values(config.protection?.areaLeaderRoles || {});
    const hasAreaLeadership = areaLeaderRoles.some(roleId => member.roles.cache.has(roleId as string));
    
    if (hasAreaLeadership && (punishmentType === 'timeout' || punishmentType === 'ban')) {
        return true;
    }

    return false;
}

export function canPunishTarget(executor: GuildMember, target: GuildMember): { canPunish: boolean; reason?: string } {
    const config = loadConfig() as any;

    // Não pode punir a si mesmo
    if (executor.id === target.id) {
        return { canPunish: false, reason: 'Você não pode punir a si mesmo.' };
    }

    // Não pode punir owners
    if (config.owners && config.owners.includes(target.id)) {
        return { canPunish: false, reason: 'Você não pode punir um owner.' };
    }

    // Verificar se o alvo é membro da staff
    if (isStaffMember(target)) {
        // Apenas owners podem punir membros da staff
        if (!config.owners || !config.owners.includes(executor.id)) {
            return { canPunish: false, reason: 'Apenas owners podem punir membros da staff.' };
        }
    }

    // Verificar hierarquia
    const hierarchyOrder = config.hierarchyOrder || [];
    const roles = config.roles || {};
    
    // Encontrar patentes mais altas
    let executorRankIndex = -1;
    let targetRankIndex = -1;
    
    for (const [rankName, roleId] of Object.entries(roles)) {
        if (executor.roles.cache.has(roleId as string)) {
            const rankIndex = hierarchyOrder.indexOf(rankName);
            if (rankIndex > executorRankIndex) {
                executorRankIndex = rankIndex;
            }
        }
        
        if (target.roles.cache.has(roleId as string)) {
            const rankIndex = hierarchyOrder.indexOf(rankName);
            if (rankIndex > targetRankIndex) {
                targetRankIndex = rankIndex;
            }
        }
    }

    // Owners e full access podem punir qualquer um (exceto outros owners)
    const fullAccessRole = config.fullAccessRoleId;
    const leaderRole = config.protectionRoles?.leaderGeneral;
    
    if (config.owners?.includes(executor.id) || 
        (fullAccessRole && executor.roles.cache.has(fullAccessRole)) ||
        (leaderRole && executor.roles.cache.has(leaderRole))) {
        return { canPunish: true };
    }

    // Verificar se o executor tem patente superior ao alvo
    if (executorRankIndex <= targetRankIndex) {
        return { canPunish: false, reason: 'Você não pode punir alguém com patente igual ou superior à sua.' };
    }

    return { canPunish: true };
}

export async function removePunishmentRole(member: GuildMember, roleId: string, reason: string = 'Punição expirada'): Promise<boolean> {
    try {
        if (member.roles.cache.has(roleId)) {
            await member.roles.remove(roleId, reason);
            logger.info({ userId: member.id, roleId, reason }, 'Cargo de punição removido');
            return true;
        }
        return false;
    } catch (error) {
        logger.error({ error, userId: member.id, roleId }, 'Erro ao remover cargo de punição');
        return false;
    }
}

export function formatDuration(duration: number, durationType: string): string {
    const durationMap = {
        'minutes': 'minutos',
        'hours': 'horas',
        'days': 'dias'
    };
    
    return `${duration} ${durationMap[durationType as keyof typeof durationMap] || durationType}`;
}

export function calculateExpirationTime(duration: number, durationType: string): number {
    const now = Date.now();
    
    switch (durationType) {
        case 'minutes':
            return now + (duration * 60 * 1000);
        case 'hours':
            return now + (duration * 60 * 60 * 1000);
        case 'days':
            return now + (duration * 24 * 60 * 60 * 1000);
        default:
            return 0;
    }
}

export async function sendPunishmentDM(
    target: GuildMember,
    punishment: any,
    punishmentType: any,
    durationText: string
): Promise<void> {
    try {
        const config = loadConfig() as any;
        const guildName = target.guild.name;
        
        // Criar embed para DM
        const dmEmbed = new EmbedBuilder()
            .setTitle(`<:cdw_white_pomba:1137012314445463663> Notificação de Punição`)
            .setDescription(`Você recebeu uma punição no servidor **${guildName}**.`)
            .addFields(
                { name: '<a:setabranca:1417092970380791850> Tipo de Punição', value: punishmentType.name, inline: true },
                { name: '<a:setabranca:1417092970380791850> Duração', value: durationText, inline: true },
                { name: '<a:setabranca:1417092970380791850> Motivo', value: punishment.reason, inline: false }
            )
            .setColor(0xE74C3C)
            .setFooter({ text: `${guildName} - Sistema de Punições`, iconURL: target.guild.iconURL() || undefined })
            .setTimestamp();

        // Adicionar informações sobre banimento se aplicável
        if (punishment.bannable) {
            dmEmbed.addFields({ 
                name: '<a:setabranca:1417092970380791850> Atenção', 
                value: 'Esta infração pode resultar em banimento permanente se for considerada de alta intensidade.', 
                inline: false 
            });
        }

        // Adicionar informações de suporte se disponível
        const supportInfo = config.supportInfo;
        if (supportInfo && supportInfo.enabled) {
            let supportText = '';
            if (supportInfo.discordInvite) {
                supportText += `📞 **Suporte Discord**: ${supportInfo.discordInvite}\n`;
            }
            if (supportInfo.email) {
                supportText += `📧 **Email**: ${supportInfo.email}\n`;
            }
            if (supportInfo.website) {
                supportText += `🌐 **Website**: ${supportInfo.website}`;
            }
            
            if (supportText) {
                dmEmbed.addFields({ 
                    name: '<a:setabranca:1417092970380791850> Precisa de Ajuda?', 
                    value: supportText, 
                    inline: false 
                });
            }
        }

        // Tentar enviar DM
        await target.send({ embeds: [dmEmbed] });
        
        logger.info({ 
            targetId: target.id, 
            punishmentType: punishmentType.name 
        }, 'DM de punição enviada com sucesso');
        
    } catch (error) {
        // Log do erro mas não falha a operação principal
        logger.warn({ 
            error, 
            targetId: target.id, 
            punishmentType: punishmentType.name 
        }, 'Não foi possível enviar DM de punição para o usuário');
    }
}

export async function logPunishment(
    target: GuildMember,
    punishment: any,
    executor: GuildMember,
    guild: Guild,
    punishmentType: any,
    additionalInfo?: string
): Promise<void> {
    try {
        // Determinar o canal de log baseado no tipo de punição
        let logChannelId: string;
        
        // Mapear tipos de punição para canais específicos
        if (punishmentType.type === 'timeout' || punishmentType.name.toLowerCase().includes('mute')) {
            // Mute -> Canal 1283418387082645627
            logChannelId = '1283418387082645627';
        } else if (punishmentType.type === 'ban' || punishmentType.name.toLowerCase().includes('ban')) {
            // Ban -> Canal 1298736953944182784
            logChannelId = '1298736953944182784';
        } else {
            // Castigo (role_add e outros) -> Canal 1199374501771751564
            logChannelId = '1199374501771751564';
        }

        const logChannel = await guild.channels.fetch(logChannelId);
        if (!logChannel?.isTextBased()) {
            logger.warn({ logChannelId }, 'Canal de log de punições não é um canal de texto');
            return;
        }

        const color = parseInt(punishmentType.logColor.replace('0x', ''), 16);
        
        let durationText = 'Permanente';
        if (punishment.duration && punishment.durationType) {
            durationText = formatDuration(punishment.duration, punishment.durationType);
        }

        const embed = new EmbedBuilder()
            .setTitle('<a:red_hypered_cdw:939928635836604457> CDW • Punição Aplicada')
            .setColor(color)
            .setDescription(`Uma punição foi aplicada com sucesso.`)
            .addFields(
                { name: '<a:mov_call1:1252739847614103687> Usuário Punido', value: `<@${target.id}>\n\`${target.id}\``, inline: true },
                { name: '<a:mov_call1:1252739847614103687> Executor', value: `<@${executor.id}>\n\`${executor.id}\``, inline: true },
                { name: '<a:mov_call1:1252739847614103687> Tipo de Punição', value: punishmentType.name, inline: true },
                { name: '<a:mov_call1:1252739847614103687> Motivo', value: punishment.reason, inline: false },
                { name: '<a:mov_call1:1252739847614103687> Duração', value: durationText, inline: true },
                { name: '<a:mov_call1:1252739847614103687> Horário', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
            )
            .setFooter({ text: 'Sistema de Punições - CDW', iconURL: guild?.iconURL() || undefined })
            .setTimestamp();

        if (punishment.bannable) {
            embed.addFields({ name: '<:z_mod_PIG_CDW:939925699551199272> Observação', value: 'Esta infração pode resultar em banimento se for de alta intensidade', inline: false });
        }

        if (additionalInfo) {
            embed.addFields({ name: '<:z_mod_PIG_CDW:939925699551199272> Informação Adicional', value: additionalInfo, inline: false });
        }

        await logChannel.send({ embeds: [embed] });
        
        // Enviar DM para o usuário punido
        await sendPunishmentDM(target, punishment, punishmentType, durationText);
        
        logger.info({ 
            targetId: target.id, 
            executorId: executor.id, 
            punishmentType: punishmentType.name,
            reason: punishment.reason,
            logChannelId: logChannelId
        }, 'Punição logada com sucesso');
        
    } catch (error) {
        logger.error({ error }, 'Erro ao enviar log de punição');
    }
}

export function getUserHighestRank(member: GuildMember): { rankName: string; rankIndex: number } {
    const config = loadConfig() as any;
    const hierarchyOrder = config.hierarchyOrder || [];
    const roles = config.roles || {};
    
    let highestRankIndex = -1;
    let highestRankName = 'Sem Patente';
    
    for (const [rankName, roleId] of Object.entries(roles)) {
        if (member.roles.cache.has(roleId as string)) {
            const rankIndex = hierarchyOrder.indexOf(rankName);
            if (rankIndex > highestRankIndex) {
                highestRankIndex = rankIndex;
                highestRankName = rankName;
            }
        }
    }
    
    return { rankName: highestRankName, rankIndex: highestRankIndex };
}

export function isUserProtected(member: GuildMember): boolean {
    const config = loadConfig() as any;
    
    // Owners são protegidos
    if (config.owners && config.owners.includes(member.id)) {
        return true;
    }
    
    // Full access são protegidos
    const fullAccessRole = config.fullAccessRoleId;
    if (fullAccessRole && member.roles.cache.has(fullAccessRole)) {
        return true;
    }
    
    // Liderança geral é protegida
    const leaderRole = config.protectionRoles?.leaderGeneral;
    if (leaderRole && member.roles.cache.has(leaderRole)) {
        return true;
    }
    
    return false;
}

export function isStaffMember(member: GuildMember): boolean {
    const config = loadConfig() as any;
    
    // Owners são staff
    if (config.owners && config.owners.includes(member.id)) {
        return true;
    }
    
    // Full access são staff
    const fullAccessRole = config.fullAccessRoleId;
    if (fullAccessRole && member.roles.cache.has(fullAccessRole)) {
        return true;
    }
    
    // Liderança geral é staff
    const leaderRole = config.protectionRoles?.leaderGeneral;
    if (leaderRole && member.roles.cache.has(leaderRole)) {
        return true;
    }
    
    // Verificar se tem alguma patente (qualquer cargo de hierarquia)
    const hierarchyOrder = config.hierarchyOrder || [];
    const roles = config.roles || {};
    
    for (const [rankName, roleId] of Object.entries(roles)) {
        if (member.roles.cache.has(roleId as string)) {
            return true;
        }
    }
    
    // Verificar lideranças de área
    const areaLeaderRoles = Object.values(config.protection?.areaLeaderRoles || {});
    const hasAreaLeadership = areaLeaderRoles.some(roleId => member.roles.cache.has(roleId as string));
    
    if (hasAreaLeadership) {
        return true;
    }
    
    return false;
}

export function canRemovePunishment(executor: GuildMember, targetId: string, originalExecutorId?: string): { canRemove: boolean; reason?: string } {
    const config = loadConfig() as any;
    
    // Owners sempre podem remover
    if (config.owners && config.owners.includes(executor.id)) {
        return { canRemove: true };
    }
    
    // Full access sempre podem remover
    const fullAccessRole = config.fullAccessRoleId;
    if (fullAccessRole && executor.roles.cache.has(fullAccessRole)) {
        return { canRemove: true };
    }
    
    // Liderança geral sempre pode remover
    const leaderRole = config.protectionRoles?.leaderGeneral;
    if (leaderRole && executor.roles.cache.has(leaderRole)) {
        return { canRemove: true };
    }
    
    // Lideranças de área podem remover
    const areaLeaderRoles = Object.values(config.protection?.areaLeaderRoles || {});
    const hasAreaLeadership = areaLeaderRoles.some(roleId => executor.roles.cache.has(roleId as string));
    
    if (hasAreaLeadership) {
        return { canRemove: true };
    }
    
    // Se foi fornecido o executor original, verificar se é a mesma pessoa
    if (originalExecutorId && executor.id === originalExecutorId) {
        return { canRemove: true };
    }
    
    return { canRemove: false, reason: 'Você só pode remover punições que você mesmo aplicou, ou precisa ser uma liderança/owner.' };
}

export async function createPunishmentEmbed(
    target: GuildMember,
    punishment: any,
    punishmentType: any,
    executor: GuildMember
): Promise<EmbedBuilder> {
    let durationText = 'Permanente';
    if (punishment.duration && punishment.durationType) {
        durationText = formatDuration(punishment.duration, punishment.durationType);
    }

    const embed = new EmbedBuilder()
        .setTitle('<a:red_hypered_cdw:939928635836604457> Confirmação de Punição')
        .setDescription(`Tem certeza que deseja aplicar esta punição?`)
        .addFields(
            { name: '<a:mov_call1:1252739847614103687> Usuário', value: `<@${target.id}>`, inline: true },
            { name: '<a:mov_call1:1252739847614103687> Punição', value: punishmentType.name, inline: true },
            { name: '<a:mov_call1:1252739847614103687> Duração', value: durationText, inline: true },
            { name: '<a:mov_call1:1252739847614103687> Motivo', value: punishment.reason, inline: false }
        )
        .setColor(0xE74C3C)
        .setFooter({ text: 'Sistema de Punições - CDW', iconURL: target.guild?.iconURL() || undefined })
        .setTimestamp();

    if (punishment.bannable) {
        embed.addFields({ name: '<:z_mod_PIG_CDW:939925699551199272> Atenção', value: 'Esta infração pode resultar em banimento permanente se for considerada de alta intensidade', inline: false });
    }

    return embed;
}
