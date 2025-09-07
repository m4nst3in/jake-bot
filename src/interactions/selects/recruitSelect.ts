import { StringSelectMenuInteraction } from 'discord.js';
export default {
    id: 'recrutar_select',
    async execute(interaction: StringSelectMenuInteraction) {
        const roles = interaction.values;
        if (!interaction.guild)
            return interaction.reply({ content: 'Servidor não encontrado.', ephemeral: true });
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member)
            return interaction.reply({ content: 'Membro não encontrado.', ephemeral: true });
        await member.roles.add(roles).catch(() => { });
        await interaction.reply({ content: 'Cargos atribuídos com sucesso.', ephemeral: true });
    }
};
