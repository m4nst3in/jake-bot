import { z } from 'zod';
const str = z.string();
const optStr = str.optional();
const strArray = z.array(str);
const stringRecord = z.record(z.string(), str);
const snowflake = z.string().regex(/^[0-9]{6,32}$/);
const maybeSnowflake = z.string().regex(/^[0-9]{1,32}$/);
export const AreaConfigSchema = z.object({
    name: str.min(1),
    guildId: snowflake,
    categoryIds: z.array(snowflake).optional(),
    channelIds: z.record(z.string(), maybeSnowflake).optional(),
    roleIds: z.record(z.string(), maybeSnowflake).optional(),
    blacklistAreas: z.array(str).optional()
});
const FlexibleIdMap = z.record(z.string(), str);
const RppEmbedSchema = z.object({
    color: z.number().int().nonnegative(),
    tool: str,
    section: str,
    section2: str.optional(),
    bullet: str,
    button: str,
    image: str.optional()
});
export const ConfigSchema = z.object({
    version: z.number().int().gte(1),
    environment: z.enum(['prod', 'dev', 'staging']).optional(),
    botId: maybeSnowflake.optional(),
    mainGuildId: snowflake,
    owners: z.array(maybeSnowflake).optional(),
    roles: FlexibleIdMap.default({}),
    vipRoles: FlexibleIdMap.optional(),
    purchasableRoles: FlexibleIdMap.optional(),
    staffRankMirrors: z.record(z.string(), z.record(z.string(), maybeSnowflake)).optional(),
    staffRankFallbacks: z.record(z.string(), maybeSnowflake).optional(),
    hierarchyOrder: z.array(str).optional(),
    progressionRoles: z.record(z.string(), z.object({
        upa: strArray,
        naoUpa: strArray.optional()
    })).optional(),
    progressionWaitingRoles: z.record(z.string(), maybeSnowflake).optional(),
    channels: FlexibleIdMap.default({}),
    blacklistAreaLogs: FlexibleIdMap.optional(),
    emojis: FlexibleIdMap.optional(),
    support: z.object({
        guildId: maybeSnowflake,
        roles: FlexibleIdMap.optional(),
        channels: FlexibleIdMap.optional(),
        categories: FlexibleIdMap.optional(),
        emojis: FlexibleIdMap.optional()
    }).optional(),
    banca: z.object({
        supportGuildId: maybeSnowflake,
        supportOrderReferenceChannelId: maybeSnowflake.optional(),
        bonusChannelId: maybeSnowflake,
        supervisionChannelId: maybeSnowflake,
        reactionEmoji: str,
        bannerUrl: str,
        basePoints: z.number(),
        bonusPoints: z.number(),
        supervisionPoints: z.number()
    }).optional(),
    journalismBanca: z.object({
        guildId: maybeSnowflake,
        categoryId: maybeSnowflake,
        prefix: str.optional()
    }).optional(),
    recruitBanca: z.object({
        guildId: maybeSnowflake,
        reactionEmoji: str,
        pointsPerMessage: z.number(),
        keyword: str,
        pointsLogChannelId: maybeSnowflake,
        plantaoLogChannelId: maybeSnowflake.optional(),
        plantaoChannelId: maybeSnowflake.optional(),
        supervisaoChannelId: maybeSnowflake.optional(),
        leadershipRoleId: maybeSnowflake.optional(),
        bannerUrl: str.optional(),
        prefix: str.optional(),
        categoryId: maybeSnowflake.optional()
    }).optional(),
    areas: z.array(AreaConfigSchema).min(1, 'areas vazio'),
    rpp: z.object({
        guilds: z.record(z.string(), z.object({
            review: maybeSnowflake,
            log: maybeSnowflake,
            role: maybeSnowflake.optional(),
            embed: RppEmbedSchema
        }))
    }).optional(),
    rppExtras: z.object({
        mainLogChannelId: maybeSnowflake.optional(),
        membershipToLeadership: z.record(z.string(), maybeSnowflake).optional(),
        permExclude: z.array(maybeSnowflake).optional()
    }).optional(),
    protection: z.object({
        botRoles: z.array(maybeSnowflake).optional(),
        alertRole: maybeSnowflake.optional(),
        alertUsers: z.array(maybeSnowflake).optional(),
        logChannel: maybeSnowflake.optional(),
        blockedRoles: z.record(z.string(), z.object({
            name: str.optional(),
            allowedLeaderRole: maybeSnowflake.optional()
        })).optional(),
        leaderUsers: z.array(maybeSnowflake).optional(),
        areaLeaderRoles: z.record(z.string(), maybeSnowflake).optional()
    }).optional(),
    permissions: z.object({
        recruit: z.object({ allowedRoles: strArray.optional() }).optional(),
        rpp: z.object({ allowedRoles: strArray.optional() }).optional(),
        transfer: z.object({ allowedRoles: strArray.optional() }).optional()
    }).optional(),
    permissionRoles: strArray.optional(),
    permissionRoleMap: FlexibleIdMap.optional(),
    baseMemberRoleId: maybeSnowflake.optional(),
    ranking: z.object({ alwaysShowOwnerIds: strArray.optional() }).optional(),
    movOrg: z.object({
        channelId: maybeSnowflake.optional(),
        roleId: maybeSnowflake.optional(),
        closeGif: str.optional(),
        openGif: str.optional(),
        windows: z.array(str).optional(),
        reopenAfterMinutes: z.number().int().optional()
    }).optional()
}).strict();
export interface AreaConfig extends z.infer<typeof AreaConfigSchema> {
}
export interface ConfigRoot extends z.infer<typeof ConfigSchema> {
}
export function validateConfig(cfg: unknown): ConfigRoot {
    const parsed = ConfigSchema.safeParse(cfg);
    if (!parsed.success) {
        const issues = parsed.error.issues.map(i => `${i.path.join('.') || '<root>'}: ${i.message}`);
        throw new Error('Falha ao validar bot-config.json:\n' + issues.join('\n'));
    }
    return parsed.data;
}
