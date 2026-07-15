const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const settings = require('../../services/settings');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('modlog')
    .setDescription('設定管理操作日誌頻道')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('設定日誌頻道')
        .addChannelOption(opt => opt.setName('頻道').setDescription('記錄管理操作（ban/kick/timeout/warn）的頻道').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('關閉管理操作日誌'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gs = settings.getGuildSettings(interaction.guild.id);

    if (sub === 'set') {
      const channel = interaction.options.getChannel('頻道');
      gs.modLog.channelId = channel.id;
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 管理日誌頻道已設為 ${channel}`, ephemeral: true });
    }

    if (sub === 'remove') {
      gs.modLog.channelId = '';
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: '✅ 管理日誌已關閉', ephemeral: true });
    }
  },
};
