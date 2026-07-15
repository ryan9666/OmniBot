const APPEAL_URL = process.env.APPEAL_URL || 'https://omnibot-yzti.onrender.com/appeal';
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { logModAction } = require('../../services/modlog');
const { canTarget } = require('../../utils/permissions');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('踢出成員')
    .addUserOption(option =>
      option.setName('成員').setDescription('要踢出的成員').setRequired(true))
    .addStringOption(option =>
      option.setName('原因').setDescription('踢出原因').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
  async execute(interaction) {
    const target = interaction.options.getMember('成員');
    const reason = interaction.options.getString('原因') || '未提供原因';

    if (!target) {
      return interaction.reply({ content: '找不到該成員', ephemeral: true });
    }

    if (target.id === interaction.client.user.id) {
      return interaction.reply({ content: '❌ 無法踢出機器人自己', ephemeral: true });
    }
    if (target.id === interaction.guild.ownerId) {
      return interaction.reply({ content: '❌ 無法踢出伺服器擁有者', ephemeral: true });
    }
    if (!canTarget(interaction.member, target)) {
      return interaction.reply({ content: '❌ 你的身分組層級不足以踢出該成員', ephemeral: true });
    }
    if (!target.kickable) {
      return interaction.reply({ content: '無法踢出該成員（權限不足）', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      await target.send(`你已被伺服器 **${interaction.guild.name}** 踢出\n原因: ${reason}\n\n📋 申訴：${APPEAL_URL}`);
    } catch {}

    await target.kick(reason);
    await logModAction(interaction.guild, 'kick', target.user, interaction.user, reason);

    const embed = new EmbedBuilder()
      .setColor(0xffa500)
      .setTitle('成員已踢出')
      .addFields(
        { name: '成員', value: target.user.tag, inline: true },
        { name: '原因', value: reason, inline: true },
        { name: '執行者', value: interaction.user.tag, inline: true },
      )
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};
