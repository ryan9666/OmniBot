const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');
const settings = require('../../services/settings');
const { isTopAdmin } = require('../../utils/permissions');

module.exports = {
  category: '工單',
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('工單系統管理')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('發送開單面板到當前頻道')
        .addStringOption(opt => opt.setName('標題').setDescription('面板標題').setRequired(false))
        .addStringOption(opt => opt.setName('說明').setDescription('面板說明').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('關閉當前工單頻道'))
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('新增成員到工單')
        .addUserOption(opt => opt.setName('成員').setDescription('要新增的成員').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('從工單移除成員')
        .addUserOption(opt => opt.setName('成員').setDescription('要移除的成員').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      const title = interaction.options.getString('標題') || '🎫 建立工單';
      const desc = interaction.options.getString('說明') || '點擊下方按鈕建立工單，管理員將為你協助';
      const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(desc);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel('📩 建立工單').setStyle(ButtonStyle.Primary)
      );
      await interaction.channel.send({ embeds: [embed], components: [row] });
      return interaction.reply({ content: '✅ 工單面板已發送', ephemeral: true });
    }

    if (sub === 'close') {
      if (!interaction.channel.name.startsWith('ticket-')) {
        return interaction.reply({ content: '❌ 這不是工單頻道', ephemeral: true });
      }
      const gs = settings.getGuildSettings(interaction.guild.id);
      const ticketRoles = gs.ticket?.roleIds || [];
      const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || isTopAdmin(interaction.member, gs.adminRoles?.topIds || []);
      const hasRole = ticketRoles.length === 0 || interaction.member.roles.cache.some(r => ticketRoles.includes(r.id));
      if (!isAdmin && !hasRole) {
        return interaction.reply({ content: '❌ 只有管理員可以關閉工單', ephemeral: true });
      }
      await interaction.reply({ content: '🔒 此工單將在 5 秒後關閉...' });
      setTimeout(() => interaction.channel.delete().catch(err => logger.warn('ticket 關閉刪除頻道失敗:', err.message)), 5000);
      return;
    }

    if (sub === 'add') {
      const target = interaction.options.getMember('成員');
      await interaction.channel.permissionOverwrites.edit(target.id, { ViewChannel: true, SendMessages: true });
      return interaction.reply({ content: `✅ 已將 ${target} 加入工單`, ephemeral: true });
    }

    if (sub === 'remove') {
      const target = interaction.options.getMember('成員');
      await interaction.channel.permissionOverwrites.edit(target.id, { ViewChannel: false });
      return interaction.reply({ content: `✅ 已將 ${target} 移出工單`, ephemeral: true });
    }
  },
};
