const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { logModAction } = require('../../services/modlog');
const { isTopAdmin } = require('../../utils/permissions');
const settings = require('../../services/settings');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('forceunmute')
    .setDescription('強制解除禁言（可愛的管管們專用）')
    .addUserOption(option =>
      option.setName('成員').setDescription('要解除禁言的成員').setRequired(true)),
  async execute(interaction) {
    const target = interaction.options.getMember('成員');

    if (!target) {
      return interaction.reply({ content: '找不到該成員', ephemeral: true });
    }

    const gs = settings.getGuildSettings(interaction.guild.id);
    if (!isTopAdmin(interaction.member, gs.adminRoles?.topIds || [])) {
      return interaction.reply({ content: '只有可愛的管管們才能使用此指令', ephemeral: true });
    }

    if (!target.communicationDisabledUntilTimestamp) {
      return interaction.reply({ content: '該成員目前未被禁言', ephemeral: true });
    }

    try {
      await target.timeout(null);
      await logModAction(interaction.guild, 'forceunmute', target.user, interaction.user, '強制解除禁言');
      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🔊 禁言已解除')
        .addFields(
          { name: '成員', value: target.user.tag, inline: true },
          { name: '執行者', value: interaction.user.tag, inline: true },
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
    } catch {
      await interaction.reply({ content: '解除禁言失敗，請確認機器人權限', ephemeral: true });
    }
  },
};
