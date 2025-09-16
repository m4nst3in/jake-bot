import { 
    SlashCommandBuilder, 
    ChatInputCommandInteraction, 
    EmbedBuilder,
    GuildMember
} from 'discord.js';
import { isOwner } from '../utils/permissions.ts';
import { logger } from '../utils/logger.ts';

export default {
    data: new SlashCommandBuilder()
        .setName('setarcargo')
        .setDescription('Força a aplicação de um cargo em um usuário')
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

            await interaction.reply({
                content: `🔄 Iniciando processo de aplicação do cargo **${role.name}** para **${member.displayName}**...`,
                ephemeral: true
            });

            console.log(`[SETARCARGO] Iniciando aplicação do cargo ${role.name} (${roleId}) para ${member.displayName} (${userId})`);
            console.log(`[SETARCARGO] Executor: ${executor.displayName} (${executor.id})`);

            let success = false;
            let totalAttempts = 0;

            // Loop principal - máximo 10 ciclos (50 segundos)
            for (let cycle = 0; cycle < 10 && !success; cycle++) {
                console.log(`[SETARCARGO] Iniciando ciclo ${cycle + 1}/10`);
                // Verificar se já tem o cargo
                if (member.roles.cache.has(roleId)) {
                    console.log(`[SETARCARGO] Cargo já aplicado detectado no ciclo ${cycle + 1}`);
                    success = true;
                    break;
                }

                // Tentativas rápidas - 15 tentativas sem delay
                console.log(`[SETARCARGO] Iniciando 15 tentativas rápidas no ciclo ${cycle + 1}`);
                for (let attempt = 0; attempt < 15 && !success; attempt++) {
                    totalAttempts++;
                    console.log(`[SETARCARGO] Tentativa ${attempt + 1}/15 (Total: ${totalAttempts})`);
                    
                    try {
                        await member.roles.add(roleId, `Aplicação forçada por ${executor.displayName}`);
                        console.log(`[SETARCARGO] Cargo aplicado na tentativa ${totalAttempts}`);
                        
                        // Verificar imediatamente se foi aplicado
                        await member.fetch(); // Atualizar cache
                        if (member.roles.cache.has(roleId)) {
                            console.log(`[SETARCARGO] ✅ SUCESSO! Cargo confirmado na tentativa ${totalAttempts}`);
                            success = true;
                            break;
                        } else {
                            console.log(`[SETARCARGO] ❌ Cargo removido imediatamente na tentativa ${totalAttempts}`);
                        }
                    } catch (error) {
                        console.log(`[SETARCARGO] ❌ Erro na tentativa ${totalAttempts}:`, error);
                        // Suprimir logs se o executor for o Jake (bot)
                        if (executor.user.id !== interaction.client.user?.id) {
                            logger.warn({ 
                                error, 
                                attempt: totalAttempts, 
                                cycle: cycle + 1 
                            }, 'Erro ao aplicar cargo');
                        }
                    }

                    // Delay mínimo entre tentativas rápidas (50ms)
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                if (!success) {
                    console.log(`[SETARCARGO] Ciclo ${cycle + 1} falhou. Aguardando 5 segundos...`);
                    // Aguardar 5 segundos antes do próximo ciclo
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    
                    // Verificar novamente após o delay
                    await member.fetch();
                    if (member.roles.cache.has(roleId)) {
                        console.log(`[SETARCARGO] ✅ Cargo detectado após delay do ciclo ${cycle + 1}`);
                        success = true;
                    } else {
                        console.log(`[SETARCARGO] Cargo ainda não presente após delay do ciclo ${cycle + 1}`);
                    }
                }
            }

            // Resultado final
            console.log(`[SETARCARGO] Processo finalizado. Sucesso: ${success}, Total de tentativas: ${totalAttempts}`);
            
            if (success) {
                console.log(`[SETARCARGO] ✅ COMANDO CONCLUÍDO COM SUCESSO!`);
                const successEmbed = new EmbedBuilder()
                    .setTitle('✅ Cargo Aplicado com Sucesso')
                    .setDescription(`O cargo **${role.name}** foi aplicado com sucesso para **${member.displayName}**.`)
                    .addFields(
                        { name: '👤 Usuário', value: `<@${member.id}>`, inline: true },
                        { name: '🎭 Cargo', value: `<@&${roleId}>`, inline: true },
                        { name: '🔢 Tentativas', value: `${totalAttempts}`, inline: true }
                    )
                    .setColor(0x00FF00)
                    .setTimestamp();

                await interaction.editReply({
                    content: null,
                    embeds: [successEmbed]
                });
            } else {
                console.log(`[SETARCARGO] ❌ COMANDO FALHOU APÓS TODAS AS TENTATIVAS!`);
                const failEmbed = new EmbedBuilder()
                    .setTitle('❌ Falha ao Aplicar Cargo')
                    .setDescription(`Não foi possível aplicar o cargo **${role.name}** para **${member.displayName}** após ${totalAttempts} tentativas em 50 segundos.`)
                    .addFields(
                        { name: '👤 Usuário', value: `<@${member.id}>`, inline: true },
                        { name: '🎭 Cargo', value: `<@&${roleId}>`, inline: true },
                        { name: '🔢 Tentativas', value: `${totalAttempts}`, inline: true }
                    )
                    .setColor(0xFF0000)
                    .setTimestamp();

                await interaction.editReply({
                    content: null,
                    embeds: [failEmbed]
                });
            }

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
