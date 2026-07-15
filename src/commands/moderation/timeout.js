const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../../services/modlog');
const { canTarget } = require('../../utils/permissions');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('將成員禁言')
    .addUserOption(option =>
      option.setName('成員').setDescription('要禁言的成員').setRequired(true))
    .addIntegerOption(option =>
      option.setName('分鐘').setDescription('禁言分鐘數（最大 40320）').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(option =>
      option.setName('原因').setDescription('禁言原因').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('成員');
    const minutes = interaction.options.getInteger('分鐘');
    const reason = interaction.options.getString('原因') || '未提供原因';

    if (!target) {
      return interaction.reply({ content: '找不到該成員', ephemeral: true });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({ content: '❌ 無法禁言機器人自己', ephemeral: true });
    }
    if (target.id === interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ 無法禁言伺服器擁有者', ephemeral: true });
    }
    if (!canTarget(interaction.member, target)) {
      return interaction.reply({ content: '❌ 你的身分組層級不足以禁言該成員', ephemeral: true });
    }
    if (!target.moderatable) {
      return interaction.reply({ content: '無法禁言該成員（權限不足）', ephemeral: true });
    }

    await interaction.deferReply();

    const duration = minutes * 60 * 1000;
    await target.timeout(duration, reason);
    await logModAction(interaction.guild, 'timeout', target.user, interaction.user, reason, { 時長: `${minutes} 分鐘` });

    const embed = new EmbedBuilder()
      .setColor(0xffff00)
      .setTitle('成員已禁言')
      .addFields(
        { name: '成員', value: target.user.tag, inline: true },
        { name: '時長', value: `${minutes} 分鐘`, inline: true },
        { name: '原因', value: reason, inline: true },
        { name: '執行者', value: interaction.user.tag, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
