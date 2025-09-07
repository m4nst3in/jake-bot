import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { RPPService } from '../../services/rppService.ts';
import { ConfigRepository } from '../../repositories/configRepository.ts';
import { RPPRepository } from '../../repositories/rppRepository.ts';
export default {
    id: 'rpp_reject',
    async execute(interaction: ButtonInteraction) {
        await interaction.deferReply({ ephemeral: true });
        const idPart = interaction.customId.split(':')[1];
        const rppId = idPart ? (isNaN(Number(idPart)) ? idPart : Number(idPart)) : undefined;
        const service = new RPPService();
        let recordUserId: string | undefined;
        if (rppId !== undefined) {
            const repo = new RPPRepository();
            const rec = await repo.findById(rppId);
            recordUserId = (rec as any)?.user_id ? String((rec as any).user_id) : undefined;
            if (!rec) {
                await interaction.editReply({ content: 'Solicitação não encontrada.' });
                return;
            }
            const currentStatus = (rec as any)?.status;
            if (currentStatus && currentStatus !== 'PENDING') {
                await interaction.editReply({ content: 'Esta solicitação já foi processada.' });
                try {
                    await interaction.message.delete().catch(() => { });
                }
                catch { }
                return;
            }
            await service.reject(rppId, interaction.user.id);
            if (interaction.guild) {
                const cfgRepo = new ConfigRepository();
                const cfg = await cfgRepo.get(interaction.guild.id);
                const roleId = cfg?.roles_config?.rpp_role;
                if (roleId) {
                    const member = recordUserId ? await interaction.guild.members.fetch(recordUserId).catch(() => null) : null;
                    if (member && member.roles.cache.has(roleId)) {
                        await member.roles.remove(roleId).catch(() => null);
                    }
                }
            }
        }
        await interaction.editReply({ content: 'RPP recusado.' });
        try {
            await interaction.message.delete().catch(() => { });
        }
        catch { }
    }
};
