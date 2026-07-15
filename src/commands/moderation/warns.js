const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isModerator } = require('../../utils/permissions');
const settings = require('../../services/settings');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('warns')
    .setDescription('查看或管理成員警告')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('查看成員的警告紀錄')
        .addUserOption(opt => opt.setName('成員').setDescription('目標成員').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('刪除特定警告')
        .addUserOption(opt => opt.setName('成員').setDescription('目標成員').setRequired(true))
        .addIntegerOption(opt => opt.setName('編號').setDescription('警告編號（用 /warns list 查看）').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('clear')
        .setDescription('清除成員的所有警告')
        .addUserOption(opt => opt.setName('成員').setDescription('目標成員').setRequired(true))),
  async execute(interaction) {
    const gs = settings.getGuildSettings(interaction.guild.id);
    if (!isModerator(interaction.member, gs.adminRoles?.modIds || [])) {
      return interaction.reply({ content: '你沒有權限執行此操作', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const target = interaction.options.getUser('成員');
      const userWarns = (gs.warnings?.[target.id] || []).slice().reverse();
      if (userWarns.length === 0) {
        return interaction.reply({ content: `✅ ${target.tag} 沒有任何警告紀錄`, ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle(`⚠️ ${target.tag} 的警告紀錄`)
        .setDescription(userWarns.map((w, i) =>
          `**#${userWarns.length - i}** - <t:${Math.floor(w.time / 1000)}:R>\n原因：${w.reason}\n管理員：<@${w.moderatorId}>`
        ).join('\n\n'))
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'remove') {
      const target = interaction.options.getUser('成員');
      const index = interaction.options.getInteger('編號') - 1;
      const warns = gs.warnings?.[target.id] || [];
      if (index < 0 || index >= warns.length) {
        return interaction.reply({ content: '❌ 無效的警告編號', ephemeral: true });
      }
      warns.splice(index, 1);
      if (warns.length === 0) delete gs.warnings[target.id];
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 已刪除 ${target.tag} 的第 ${index + 1} 筆警告`, ephemeral: true });
    }

    if (sub === 'clear') {
      const target = interaction.options.getUser('成員');
      if (!gs.warnings?.[target.id]) {
        return interaction.reply({ content: `✅ ${target.tag} 沒有任何警告紀錄`, ephemeral: true });
      }
      delete gs.warnings[target.id];
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 已清除 ${target.tag} 的所有警告`, ephemeral: true });
    }
  },
};
