const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');
const { logModAction } = require('../../services/modlog');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('clear')
    .setDescription('清除指定數量的訊息')
    .addIntegerOption(option =>
      option.setName('數量').setDescription('要清除的訊息數（1-100）').setRequired(true).setMinValue(1).setMaxValue(100))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
  async execute(interaction) {
    const amount = interaction.options.getInteger('數量');

    let deletedSize = 0;
    try {
      const messages = await interaction.channel.bulkDelete(amount, true);
      deletedSize = messages.size;
    } catch (err) {
      logger.warn('clear bulkDelete 失敗:', err.message);
      const messages = await interaction.channel.bulkDelete(amount, false);
      deletedSize = messages.size;
    }
    await logModAction(interaction.guild, 'clear', interaction.user, interaction.user, `清除 ${deletedSize} 則訊息`);

    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setDescription(`已清除 ${deletedSize} 則訊息`)
      .setTimestamp();

    const reply = await interaction.reply({ embeds: [embed] });
    setTimeout(() => reply.delete().catch(err => logger.warn('clear 回覆刪除失敗:', err.message)), 3000);
  },
};
