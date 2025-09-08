import { ButtonInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder } from 'discord.js';

// Mapeamento das categorias por área
const AREA_CATEGORIES: Record<string,string> = {
  design: '1183909150447648814',
  eventos: '1183909150447648816',
  jornalismo: '1230265006839566367',
  movcall: '1183909150783197293',
  suporte: '1183909150980325386',
  recrutamento: '1183909150623805453',
  outros: '1398347839729307759'
};

export function resolveCategory(areaKey: string){
  return AREA_CATEGORIES[areaKey];
}

export default {
  id: /design_request_pick:.+/,
  async execute(interaction: ButtonInteraction){
    const key = interaction.customId.split(':')[1];
    const categoryId = resolveCategory(key);
    if(!categoryId){ await interaction.reply({ content: 'Área inválida.', ephemeral: true }); return; }

    const { TextInputStyle }: any = await import('discord.js');
    const modal = new ModalBuilder().setCustomId(`design_request_modal:${key}`).setTitle(`Pedido • ${key.toUpperCase()}`);
    const texto = new TextInputBuilder().setCustomId('design_texto').setLabel('Texto na Arte').setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(50);
    const dim = new TextInputBuilder().setCustomId('design_dim').setLabel('Dimensão').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 1080x1080').setRequired(true);
    const cores = new TextInputBuilder().setCustomId('design_cores').setLabel('Cores').setStyle(TextInputStyle.Short).setRequired(true);
    const desc = new TextInputBuilder().setCustomId('design_desc').setLabel('Descrição do pedido').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(800);
    const entrega = new TextInputBuilder().setCustomId('design_entrega').setLabel('Data de entrega (DD/MM)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('DD/MM');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(texto),
      new ActionRowBuilder<TextInputBuilder>().addComponents(dim),
      new ActionRowBuilder<TextInputBuilder>().addComponents(cores),
      new ActionRowBuilder<TextInputBuilder>().addComponents(desc),
      new ActionRowBuilder<TextInputBuilder>().addComponents(entrega)
    );

    await interaction.showModal(modal);
  }
};
