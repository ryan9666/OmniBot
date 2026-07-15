const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const settings = require('../../services/settings');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('autorole')
    .setDescription('設定新成員自動獲得的身分組')
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('設定自動身分組')
        .addRoleOption(opt => opt.setName('身分組').setDescription('新成員加入時自動獲得的角色').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('移除自動身分組設定'))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('查看目前設定'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gs = settings.getGuildSettings(interaction.guild.id);

    if (sub === 'set') {
      const role = interaction.options.getRole('身分組');
      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({ content: '❌ 機器人權限不足以管理該身分組', ephemeral: true });
      }
      gs.autoRoleId = role.id;
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 新成員加入時將自動獲得 ${role}`, ephemeral: true });
    }

    if (sub === 'remove') {
      gs.autoRoleId = '';
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: '✅ 已移除自動身分組設定', ephemeral: true });
    }

    if (sub === 'status') {
      const role = gs.autoRoleId ? interaction.guild.roles.cache.get(gs.autoRoleId) : null;
      return interaction.reply({ content: role ? `✅ 目前自動身分組：${role}` : '❌ 未設定自動身分組', ephemeral: true });
    }
  },
};
