const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('massrole')
    .setDescription('批次管理身分組')
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('批次新增身分組')
        .addRoleOption(opt => opt.setName('身分組').setDescription('要新增的身分組').setRequired(true))
        .addStringOption(opt => opt.setName('成員').setDescription('成員 ID，用空格或逗號分隔').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('批次移除身分組')
        .addRoleOption(opt => opt.setName('身分組').setDescription('要移除的身分組').setRequired(true))
        .addStringOption(opt => opt.setName('成員').setDescription('成員 ID，用空格或逗號分隔').setRequired(true)))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const role = interaction.options.getRole('身分組');
    const raw = interaction.options.getString('成員');

    if (role.position >= interaction.guild.members.me.roles.highest.position) {
      return interaction.reply({ content: '❌ 機器人權限不足以管理該身分組', ephemeral: true });
    }

    const ids = raw.split(/[\s,]+/).filter(id => /^\d{17,20}$/.test(id));
    if (ids.length === 0) return interaction.reply({ content: '❌ 請提供有效的成員 ID', ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    let success = 0;
    let fail = 0;
    const failedUsers = [];

    for (const id of ids) {
      try {
        const member = await interaction.guild.members.fetch(id).catch(() => null);
        if (!member) { fail++; failedUsers.push(id); continue; }
        if (sub === 'add') {
          if (member.roles.cache.has(role.id)) { success++; continue; }
          await member.roles.add(role);
        } else {
          if (!member.roles.cache.has(role.id)) { success++; continue; }
          await member.roles.remove(role);
        }
        success++;
      } catch (err) {
        fail++;
        failedUsers.push(id);
        logger.error(`massrole ${sub} 失敗 (${id}):`, err.message);
      }
    }

    const actionText = sub === 'add' ? '新增' : '移除';
    let msg = `✅ ${actionText}身分組完成：${success} 成功，${fail} 失敗`;
    if (failedUsers.length > 0 && failedUsers.length <= 5) {
      msg += `\n失敗 ID：${failedUsers.join(', ')}`;
    }
    await interaction.editReply({ content: msg });
  },
};
