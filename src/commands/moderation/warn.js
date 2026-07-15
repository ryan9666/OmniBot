const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isModerator, canTarget } = require('../../utils/permissions');
const { logModAction } = require('../../services/modlog');
const settings = require('../../services/settings');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('警告成員（可惡的管管們以上可用）')
    .addUserOption(option =>
      option.setName('成員').setDescription('要警告的成員').setRequired(true))
    .addStringOption(option =>
      option.setName('原因').setDescription('警告原因').setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getMember('成員');
    const reason = interaction.options.getString('原因') || '未提供原因';

    if (!target) {
      return interaction.reply({ content: '找不到該成員', ephemeral: true });
    }

    const gs = settings.getGuildSettings(interaction.guild.id);
    if (!isModerator(interaction.member, gs.adminRoles?.modIds || [])) {
      return interaction.reply({ content: '你沒有權限執行此操作', ephemeral: true });
    }

    if (!canTarget(interaction.member, target)) {
      return interaction.reply({ content: '你無法對該成員執行此操作（階級不足）', ephemeral: true });
    }

    try {
      await target.send(`你在伺服器 **${interaction.guild.name}** 收到警告\n原因: ${reason}`);
    } catch {
      // 私訊失敗不影響
    }

    if (!gs.warnings) gs.warnings = {};
    if (!gs.warnings[target.id]) gs.warnings[target.id] = [];
    gs.warnings[target.id].push({
      id: Date.now().toString(36),
      reason,
      moderatorId: interaction.user.id,
      time: Date.now(),
    });
    settings.updateGuildSettings(interaction.guild.id, gs);
    await logModAction(interaction.guild, 'warn', target.user, interaction.user, reason);

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle('⚠️ 成員已被警告')
      .addFields(
        { name: '成員', value: target.user.tag, inline: true },
        { name: '原因', value: reason, inline: true },
        { name: '執行者', value: interaction.user.tag, inline: true },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
