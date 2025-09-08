import { GuildMember, Events, EmbedBuilder } from 'discord.js';
import { logger } from '../utils/logger.ts';
import { loadConfig } from '../config/index.ts';

// Proteção de cargos sensíveis
// Remove cargos bloqueados se adicionados por alguém não autorizado.

const BOT_ROLE_IDS = ['1080700822624686140','934635845846192162'];
// Mentions fixas em toda log de proteção
const PROTECTION_ALERT_ROLE = '1411223951350435961';
const PROTECTION_ALERT_USERS = ['511264305832919050','418824536570593280'];
// allowedLeaderRoles: permite múltiplos cargos de liderança autorizados.
// allowedLeaderRole: legado (um único). Se ambos existirem, allowedLeaderRoles tem prioridade.
const BLOCKED_ROLES: Record<string, { allowedLeaderRoles?: string[]; allowedLeaderRole?: string; name: string }> = {
  '1136861844540227624': { name: 'Design', allowedLeaderRole: '1153690317262950400' }, // Design member, leader role id from config areas
  '1136861840421425284': { name: 'Suporte', allowedLeaderRole: '1136889351033344000' },
  '1136868804677357608': { name: 'Recrutamento', allowedLeaderRole: '1153690317262950400' },
  '1136861814328668230': { name: 'Mov Call', allowedLeaderRole: '1153690317262950400' },
  '1170196352114901052': { name: 'Eventos', allowedLeaderRole: '1153690317262950400' },
  '1247967720427884587': { name: 'Jornalismo', allowedLeaderRole: '1153690317262950400' },
  '1136864742997250118': { name: 'Design', allowedLeaderRole: '1411223951350435961' },
  '1136889351033344000': { name: 'Suporte', allowedLeaderRole: '1411223951350435961' },
  '1136864716434710608': { name: 'Eventos', allowedLeaderRole: '1411223951350435961' },
  '1136864678253969430': { name: 'Mov Call', allowedLeaderRole: '1411223951350435961' },
  '1247610015787913360': { name: 'Jornalismo', allowedLeaderRole: '1411223951350435961' },
  '1153690317262950400': { name: 'Recrutamento', allowedLeaderRole: '1411223951350435961' },
  '1411223951350435961': { name: 'Líder Geral' }
};

function isOwner(userId: string): boolean {
  const cfg: any = loadConfig();
  return Array.isArray(cfg.owners) && cfg.owners.includes(userId);
}

export function registerProtectionListener(client: any) {
  client.on(Events.GuildMemberUpdate, async (oldMember: GuildMember | any, newMember: GuildMember) => {
    try {
      if (!newMember || !newMember.guild) return;
      const added = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
      if (!added.size) return;
      for (const role of added.values()) {
        const blockInfo = BLOCKED_ROLES[role.id];
        if (!blockInfo) continue;
        let executorId: string | null = null;
        try {
          const audit = await newMember.guild.fetchAuditLogs({ type: 25, limit: 5 }); // MEMBER_ROLE_UPDATE
          const entry = audit.entries.find(e => (e as any).target?.id === newMember.id && (e as any).changes?.some((c: any)=> c.key === '$add' && c.new?.some((r: any)=> r.id === role.id)));
          if (entry) executorId = entry.executor?.id || null;
        } catch {}
        let allowed = false;
        if (executorId) {
          if (isOwner(executorId)) {
            allowed = true;
          } else {
            const execMember = newMember.guild.members.cache.get(executorId) || await newMember.guild.members.fetch(executorId).catch(()=>null);
            if (execMember) {
              if (BOT_ROLE_IDS.some(id => execMember.roles.cache.has(id))) {
                allowed = true;
              } else if (blockInfo.allowedLeaderRoles && blockInfo.allowedLeaderRoles.length) {
                if (blockInfo.allowedLeaderRoles.some(rid => execMember.roles.cache.has(rid))) allowed = true;
              } else if (blockInfo.allowedLeaderRole) {
                if (execMember.roles.cache.has(blockInfo.allowedLeaderRole)) allowed = true;
              }
            }
          }
        }
        if (!allowed) {
          await newMember.roles.remove(role.id).catch(()=>{});
          logger.warn({ user: newMember.id, role: role.id, roleName: blockInfo.name, executorId }, 'Proteção: cargo bloqueado removido');
          const cfg: any = loadConfig();
          const mainGuildId = cfg.mainGuildId;
            const logChannelId = '1414540666171559966';
          if (newMember.guild.id === mainGuildId) {
            try {
              const ch: any = await newMember.guild.channels.fetch(logChannelId).catch(()=>null);
              if (ch && ch.isTextBased()) {
                const embed = new EmbedBuilder()
                  .setTitle('<:z_mod_DiscordShield:934654129811357726> Proteção de Cargos • Ação Executada')
                  .setColor(0xE74C3C)
                  .setDescription(`Um cargo protegido foi aplicado de forma não autorizada e removido imediatamente.`)
                  .addFields(
                    { name: '<a:vSETAverdeclaro:1386504186396676141> Usuário Afetado', value: `<@${newMember.id}>\n\`${newMember.id}\`` },
                    { name: '<a:vSETAverdeclaro:1386504186396676141> Executor', value: executorId ? `<@${executorId}>\n\`${executorId}\`` : 'Desconhecido' },
                    { name: '<a:vSETAverdeclaro:1386504186396676141> Cargo Bloqueado', value: `<@&${role.id}>\n\`${role.id}\`` },
                    { name: '<a:vSETAverdeclaro:1386504186396676141> Identificação', value: `Nome interno: **${blockInfo.name}**` },
                    { name: '<a:vSETAverdeclaro:1386504186396676141> Ação', value: 'Cargo removido automaticamente' },
                    { name: '<a:vSETAverdeclaro:1386504186396676141> Horário', value: `<t:${Math.floor(Date.now()/1000)}:F>` }
                  )
                  .setFooter({ text: 'Sistema de Proteção de Cargos' })
                  .setTimestamp();
                const execMember = executorId ? await newMember.guild.members.fetch(executorId).catch(()=>null) : null;
                if (execMember?.user?.avatarURL()) embed.setThumbnail(execMember.user.avatarURL()!);
                const mentionContent = `<@&${PROTECTION_ALERT_ROLE}> ${PROTECTION_ALERT_USERS.map(id => `<@${id}>`).join(' ')}`;
                ch.send({ content: mentionContent, embeds: [embed] }).catch(()=>{});
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Erro proteção de cargos');
    }
  });
}
