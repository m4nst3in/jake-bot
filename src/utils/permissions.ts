import { GuildMember } from 'discord.js';
import { loadConfig } from '../config/index.ts';

function norm(str: string){ return (str||'').trim().toLowerCase(); }

export const OWNER_IDS = ['1382506667211493429','511264305832919050','199242071507337216','418824536570593280'];

export function isOwner(member: GuildMember | null | undefined){
  if(!member) return false; return OWNER_IDS.includes(member.id);
}

export function isAdminFromMember(member: GuildMember | null | undefined){
  if(isOwner(member)) return true; // owners sempre
  if(!member) return false;
  const cfg: any = loadConfig();
  const adminRole = cfg.roles?.admin;
  if(adminRole && member.roles.cache.has(adminRole)) return true;
  return member.permissions?.has('Administrator');
}

export function getAreaConfigByName(areaName: string){
  const cfg:any = loadConfig();
  return (cfg.areas||[]).find((a:any)=> norm(a.name) === norm(areaName));
}

export function isAreaLeader(member: GuildMember | null | undefined, areaName: string){
  if(!member) return false;
  const area = getAreaConfigByName(areaName);
  if(!area?.roleIds?.lead) return false;
  return member.roles.cache.has(area.roleIds.lead);
}

export function getMemberLeaderAreas(member: GuildMember | null | undefined){
  if(!member) return [] as string[];
  const cfg:any = loadConfig();
  const out: string[] = [];
  for (const a of (cfg.areas||[])){
    if(a.roleIds?.lead && member.roles.cache.has(a.roleIds.lead)) out.push(a.name);
  }
  return out;
}

export function hasAnyLeadership(member: GuildMember | null | undefined){
  return getMemberLeaderAreas(member).length > 0;
}

export function assertAreaPermission(member: GuildMember | null | undefined, areaName: string){
  if(isOwner(member)) return true; // dono pode tudo
  return isAdminFromMember(member) || isAreaLeader(member, areaName);
}

export function canManageAnyArea(member: GuildMember | null | undefined){
  return isOwner(member); // somente owners para mexer em áreas onde não é líder
}

export function canUsePdfForArea(member: GuildMember | null | undefined, areaName: string){
  if(isOwner(member)) return true; return isAreaLeader(member, areaName);
}

export function canUseRppArea(member: GuildMember | null | undefined, areaName: string){
  if(isOwner(member)) return true; return isAreaLeader(member, areaName);
}
