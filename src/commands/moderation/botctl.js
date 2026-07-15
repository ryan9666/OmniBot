const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isTopAdmin } = require('../../utils/permissions');
const settings = require('../../services/settings');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('botctl')
    .setDescription('機器人 root 指令（可愛的管管們專用）')
    .addSubcommand(sub =>
      sub.setName('reload')
        .setDescription('重新載入所有指令'))
    .addSubcommand(sub =>
      sub.setName('ping')
        .setDescription('查看機器人詳細狀態')),
  async execute(interaction) {
    const gs = settings.getGuildSettings(interaction.guild.id);
    if (!isTopAdmin(interaction.member, gs.adminRoles?.topIds || [])) {
      return interaction.reply({ content: '只有可愛的管管們才能使用此指令', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'ping') {
      const uptime = process.uptime();
      const hours = Math.floor(uptime / 3600);
      const minutes = Math.floor((uptime % 3600) / 60);
      const seconds = Math.floor(uptime % 60);
      const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🤖 機器人狀態')
        .addFields(
          { name: '延遲', value: `${interaction.client.ws.ping}ms`, inline: true },
          { name: '運行時間', value: `${hours}h ${minutes}m ${seconds}s`, inline: true },
          { name: '伺服器數', value: `${interaction.client.guilds.cache.size}`, inline: true },
          { name: '指令數', value: `${interaction.client.commands.size}`, inline: true },
          { name: 'Node.js', value: process.version, inline: true },
        )
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'reload') {
      try {
        const commandFiles = Object.keys(require.cache).filter(k => k.includes(`commands${require('path').sep}`));
        commandFiles.forEach(k => delete require.cache[k]);
        interaction.client.commands.clear();
        const { registerCommands } = require('../../utils/command-handler');
        registerCommands(interaction.client);
        await interaction.reply({ content: `✅ 已重新載入 ${interaction.client.commands.size} 個指令`, ephemeral: true });
      } catch (err) {
        await interaction.reply({ content: `❌ 重新載入失敗: ${err.message}`, ephemeral: true });
      }
    }
  },
};
