const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const settings = require('../../services/settings');
const { logModAction } = require('../../services/modlog');
const { canTarget } = require('../../utils/permissions');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('tempban')
    .setDescription('暫時封鎖成員，時間到自動解封')
    .addUserOption(option =>
      option.setName('成員').setDescription('要封鎖的成員').setRequired(true))
    .addIntegerOption(option =>
      option.setName('分鐘').setDescription('封鎖分鐘數').setRequired(true).setMinValue(1).setMaxValue(43200))
    .addStringOption(option =>
      option.setName('原因').setDescription('封鎖原因').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('成員');
    const minutes = interaction.options.getInteger('分鐘');
    const reason = interaction.options.getString('原因') || '未提供原因';

    if (!target) return interaction.reply({ content: '找不到該成員', ephemeral: true });
    if (target.id === interaction.client.user.id) {
      return interaction.reply({ content: '❌ 無法封鎖機器人自己', ephemeral: true });
    }
    if (target.id === interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ 無法封鎖伺服器擁有者', ephemeral: true });
    }
    if (!canTarget(interaction.member, target)) {
      return interaction.reply({ content: '❌ 你的身分組層級不足以封鎖該成員', ephemeral: true });
    }
    if (!target.bannable) return interaction.reply({ content: '無法封鎖該成員（權限不足）', ephemeral: true });

    await interaction.deferReply();

    const expiresAt = Date.now() + minutes * 60 * 1000;

    try {
      await target.send(`你已在伺服器 **${interaction.guild.name}** 被暫時封鎖 ${minutes} 分鐘\n原因: ${reason}\n\n⏰ 將於 <t:${Math.floor(expiresAt / 1000)}:R> 自動解封`);
    } catch {}

    await target.ban({ reason: `[臨時封鎖] ${reason}` });

    const gs = settings.getGuildSettings(interaction.guild.id);
    if (!gs.tempBans) gs.tempBans = {};
    gs.tempBans[target.id] = { guildId: interaction.guild.id, expiresAt, reason };
    settings.updateGuildSettings(interaction.guild.id, gs);
    await logModAction(interaction.guild, 'tempban', target.user, interaction.user, reason, { 時長: `${minutes} 分鐘`, 自動解封: `<t:${Math.floor(expiresAt / 1000)}:R>` });

    const embed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('🔨 成員已暫時封鎖')
      .addFields(
        { name: '成員', value: target.user.tag, inline: true },
        { name: '時長', value: `${minutes} 分鐘`, inline: true },
        { name: '原因', value: reason, inline: true },
        { name: '執行者', value: interaction.user.tag, inline: true },
        { name: '自動解封', value: `<t:${Math.floor(expiresAt / 1000)}:R>`, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
