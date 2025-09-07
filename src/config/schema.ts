export interface AreaConfig {
  name: string
  guildId: string
  categoryIds?: string[]
  channelIds?: Record<string,string>
  roleIds?: Record<string,string>
  blacklistAreas?: string[]
}

export interface GlobalRolesConfig {
  staff?: string
  admin?: string
  mod?: string
  rppManager?: string
  recruiter?: string
  [key: string]: string | undefined
}

export interface GlobalChannelsConfig {
  rppLog?: string
  rppReview?: string
  recruitLog?: string
  blacklistLog?: string
  auditLog?: string
  [key: string]: string | undefined
}

export interface ConfigRoot {
  mainGuildId: string
  environment?: 'prod' | 'dev' | 'staging'
  roles: GlobalRolesConfig
  channels: GlobalChannelsConfig
  areas: AreaConfig[]
  banca?: {
    supportGuildId: string
    bonusChannelId: string
    supervisionChannelId: string
    reactionEmoji: string
    bannerUrl: string
    basePoints: number
    bonusPoints: number
    supervisionPoints: number
  }
  recruitBanca?: {
    guildId: string
    reactionEmoji: string
    pointsPerMessage: number
    keyword: string
    pointsLogChannelId: string
    bannerUrl?: string
    prefix?: string
  categoryId?: string
  }
  rpp?: {
    guilds: Record<string, {
      review: string
      log: string
      role?: string
      embed: {
        color: number
        tool: string
        section: string
  section2?: string
        bullet: string
        button: string
        image?: string
      }
    }>
  }
  version: number
}

export function validateConfig(cfg: any): ConfigRoot {
  if (!cfg || typeof cfg !== 'object') throw new Error('Config inválida');
  if (!cfg.mainGuildId) throw new Error('mainGuildId ausente');
  if (!Array.isArray(cfg.areas)) throw new Error('areas deve ser array');
  return cfg as ConfigRoot;
}
