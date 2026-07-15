const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('設定頻道慢速模式')
    .addIntegerOption(opt =>
      opt.setName('秒數').setDescription('每則訊息間隔秒數（0=關閉）').setRequired(true).setMinValue(0).setMaxValue(21600))
    .addChannelOption(opt =>
      opt.setName('頻道').setDescription('目標頻道（預設為當前頻道）').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const seconds = interaction.options.getInteger('秒數');
    const channel = interaction.options.getChannel('頻道') || interaction.channel;
    if (channel.type !== ChannelType.GuildText && channel.type !== ChannelType.GuildAnnouncement) {
      return interaction.reply({ content: '❌ 請選擇一個文字頻道', ephemeral: true });
    }
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: '❌ 機器人缺少管理頻道權限', ephemeral: true });
    }
    await channel.setRateLimitPerUser(seconds);
    const msg = seconds === 0 ? '已關閉慢速模式' : `慢速模式已設為 ${seconds} 秒`;
    await interaction.reply({ content: `⏱️ ${channel} ${msg}`, ephemeral: false });
  },
};
