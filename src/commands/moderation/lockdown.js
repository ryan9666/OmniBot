const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('lockdown')
    .setDescription('鎖定/解鎖頻道')
    .addSubcommand(sub =>
      sub.setName('lock')
        .setDescription('鎖定頻道，禁止一般成員發言')
        .addChannelOption(opt =>
          opt.setName('頻道').setDescription('要鎖定的頻道（預設為當前頻道）').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('unlock')
        .setDescription('解鎖頻道，恢復一般成員發言權限')
        .addChannelOption(opt =>
          opt.setName('頻道').setDescription('要解鎖的頻道（預設為當前頻道）').setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('頻道') || interaction.channel;
    if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: '❌ 機器人缺少管理頻道權限', ephemeral: true });
    }
    if (sub === 'lock') {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: false });
      await interaction.reply({ content: `🔒 已鎖定 ${channel}，僅管理員可發言`, ephemeral: false });
    } else {
      await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { SendMessages: null });
      await interaction.reply({ content: `🔓 已解鎖 ${channel}，一般成員可發言`, ephemeral: false });
    }
  },
};
