const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const settings = require('../../services/settings');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('設定按鈕驗證系統')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('在指定頻道發送驗證按鈕')
        .addChannelOption(opt => opt.setName('頻道').setDescription('發送驗證面板的頻道').setRequired(true))
        .addRoleOption(opt => opt.setName('身分組').setDescription('驗證後給予的身分組').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('移除驗證系統設定'))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gs = settings.getGuildSettings(interaction.guild.id);

    if (sub === 'setup') {
      const channel = interaction.options.getChannel('頻道');
      const role = interaction.options.getRole('身分組');

      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({ content: '❌ 機器人權限不足以管理該身分組', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✅ 身分驗證')
        .setDescription('點擊下方按鈕完成驗證，即可獲得伺服器權限')
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('verify_click').setLabel('✅ 點我驗證').setStyle(ButtonStyle.Success)
      );

      const msg = await channel.send({ embeds: [embed], components: [row] });

      gs.verification = { channelId: channel.id, roleId: role.id, messageId: msg.id, enabled: true };
      settings.updateGuildSettings(interaction.guild.id, gs);

      return interaction.reply({ content: `✅ 驗證系統已設定！請到 ${channel} 查看`, ephemeral: true });
    }

    if (sub === 'remove') {
      gs.verification = { channelId: '', roleId: '', messageId: '', enabled: false };
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: '✅ 驗證系統已移除', ephemeral: true });
    }
  },
};
