import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionsBitField, ActionRowBuilder, ModalBuilder, TextInputBuilder } from 'discord.js';
import { PointsService } from '../services/pointsService.ts';
import { AREAS, isValidArea } from '../constants/areas.ts';
const svc = new PointsService();
export default {
    data: new SlashCommandBuilder()
        .setName('reset')
        .setDescription('Resetar dados (pontos, rpp ou blacklist)')
        .addStringOption(o => o.setName('tipo')
        .setDescription('O que resetar')
        .setRequired(true)
        .addChoices({ name: 'Pontos', value: 'pontos' }, { name: 'RPP', value: 'rpp' }, { name: 'Blacklist', value: 'blacklist' }))
        .addStringOption(o => {
        let opt = o.setName('area').setDescription('Área (para pontos ou blacklist)').setRequired(false);
        for (const a of AREAS)
            opt = opt.addChoices({ name: a, value: a });
        return opt;
    })
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(interaction: ChatInputCommandInteraction) {
        const cfg: any = (await import('../config/index.ts')).loadConfig();
        const owners: string[] = cfg.owners || [];
        const fullAccessRoleId: string | undefined = cfg.fullAccessRoleId;
        const hasFull = !!(fullAccessRoleId && (interaction.member as any)?.roles?.cache?.has(fullAccessRoleId));
        if (!owners.includes(interaction.user.id) && !hasFull) {
            return interaction.reply({ content: 'Sem permissão para resetar, tá metendo o nariz aonde não deve.', ephemeral: true });
        }
        const tipo = interaction.options.getString('tipo', true);
        const area = interaction.options.getString('area');
        if (tipo === 'pontos' && area && !isValidArea(area)) {
            return interaction.reply({ content: 'Área inválida.', ephemeral: true });
        }
        if (tipo === 'rpp' && area) {
            return interaction.reply({ content: 'Reset de RPP não suporta áreas no momento.', ephemeral: true });
        }
        if (tipo === 'blacklist' && area && !isValidArea(area)) {
            return interaction.reply({ content: 'Área inválida para blacklist.', ephemeral: true });
        }
        const modal = new ModalBuilder()
            .setCustomId(tipo === 'pontos'
            ? `reset_points_modal:${area || '__all__'}`
            : tipo === 'rpp'
                ? 'reset_rpp_modal:__all__'
                : `reset_blacklist_modal:${area || '__all__'}`)
            .setTitle(`Confirmar Reset ${tipo.toUpperCase()}`);
        const input = new TextInputBuilder()
            .setCustomId('confirm')
            .setLabel('Digite confirmar para prosseguir')
            .setRequired(true)
            .setStyle(1 as any);
        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(input);
        modal.addComponents(row);
        await interaction.showModal(modal);
    }
};
