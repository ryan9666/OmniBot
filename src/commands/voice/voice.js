const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const settings = require('../../services/settings');
const logger = require('../../utils/logger');

module.exports = {
  category: '語音',
  data: new SlashCommandBuilder()
    .setName('voice')
    .setDescription('管理你的語音包房')
    .addSubcommand(sub =>
      sub.setName('rename')
        .setDescription('重新命名你的包房')
        .addStringOption(opt => opt.setName('名稱').setDescription('新名稱').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('limit')
        .setDescription('設定包房人數上限')
        .addIntegerOption(opt => opt.setName('人數').setDescription('上限人數（0 = 無限制）').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('lock')
        .setDescription('鎖定包房（禁止他人加入）'))
    .addSubcommand(sub =>
      sub.setName('unlock')
        .setDescription('解鎖包房'))
    .addSubcommand(sub =>
      sub.setName('kick')
        .setDescription('將成員移出包房')
        .addUserOption(opt => opt.setName('成員').setDescription('要移出的成員').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('give')
        .setDescription('轉移包房所有權')
        .addUserOption(opt => opt.setName('成員').setDescription('新房主').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('設定自動包房創建頻道（管理員專用）')
        .addChannelOption(opt => opt.setName('頻道').setDescription('語音頻道').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({ content: '❌ 只有管理員才能使用此指令', ephemeral: true });
      }
      const channel = interaction.options.getChannel('頻道');
      if (channel.type !== ChannelType.GuildVoice) {
        return interaction.reply({ content: '請選擇一個語音頻道', ephemeral: true });
      }
      const gs = settings.getGuildSettings(interaction.guild.id);
      gs.autoVoice = { channelId: channel.id };
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 已將 ${channel} 設為自動包房創建頻道`, ephemeral: true });
    }

    const ownerId = interaction.client.voiceOwners?.get(interaction.member.voice.channelId);
    if (interaction.member.id !== ownerId) {
      return interaction.reply({ content: '❌ 你不在自己的包房中', ephemeral: true });
    }

    const channel = interaction.member.voice.channel;

    try {
      switch (sub) {
        case 'rename': {
          const name = interaction.options.getString('名稱');
          await channel.setName(name);
          await interaction.reply({ content: `✅ 已重新命名為 ${name}`, ephemeral: true });
          break;
        }
        case 'limit': {
          const limit = interaction.options.getInteger('人數');
          await channel.setUserLimit(limit);
          await interaction.reply({ content: `✅ 人數上限已設為 ${limit === 0 ? '無限制' : limit}`, ephemeral: true });
          break;
        }
        case 'lock': {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: false });
          await interaction.reply({ content: '🔒 包房已鎖定', ephemeral: true });
          break;
        }
        case 'unlock': {
          await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, { Connect: null });
          await interaction.reply({ content: '🔓 包房已解鎖', ephemeral: true });
          break;
        }
        case 'kick': {
          const target = interaction.options.getMember('成員');
          if (target.voice.channelId === channel.id) {
            await target.voice.disconnect();
            await interaction.reply({ content: `✅ 已將 ${target} 移出包房`, ephemeral: true });
          } else {
            await interaction.reply({ content: '❌ 該成員不在你的包房中', ephemeral: true });
          }
          break;
        }
        case 'give': {
          const target = interaction.options.getMember('成員');
          if (target.voice.channelId === channel.id) {
            interaction.client.voiceOwners.set(channel.id, target.id);
            await channel.permissionOverwrites.edit(target.id, {
              Connect: true,
              ManageChannels: true,
              MuteMembers: true,
              DeafenMembers: true,
              MoveMembers: true,
            });
            await channel.permissionOverwrites.delete(interaction.user.id);
            await interaction.reply({ content: `✅ 已將包房所有權轉移給 ${target}`, ephemeral: true });
          } else {
            await interaction.reply({ content: '❌ 該成員不在你的包房中', ephemeral: true });
          }
          break;
        }
      }
    } catch (err) {
      logger.error(`語音包房操作失敗:`, err);
      await interaction.reply({ content: '❌ 操作失敗', ephemeral: true });
    }
  },
};
