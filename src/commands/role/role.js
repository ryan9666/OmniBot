const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, PermissionFlagsBits } = require('discord.js');
const settings = require('../../services/settings');
const logger = require('../../utils/logger');

module.exports = {
  category: '身分組',
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('自助領取或移除身分組'),
  async execute(interaction) {
    const gs = settings.getGuildSettings(interaction.guild.id);
    const allowedIds = gs.selfRoles || [];

    if (allowedIds.length === 0) {
      return interaction.reply({ content: '此伺服器尚未設定可領取的身分組', ephemeral: true });
    }

    const roles = allowedIds
      .map(id => interaction.guild.roles.cache.get(id))
      .filter(Boolean)
      .slice(0, 25);

    if (roles.length === 0) {
      return interaction.reply({ content: '可領取的身分組已不存在', ephemeral: true });
    }

    const member = interaction.member;
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('🎭 自助領取身分組')
      .setDescription('點擊按鈕領取或移除身分組\n🟢 已擁有　⚫ 未擁有')
      .setTimestamp();

    const rows = [];
    let currentRow = new ActionRowBuilder();

    for (const role of roles) {
      const has = member.roles.cache.has(role.id);
      const btn = new ButtonBuilder()
        .setCustomId(`role_${role.id}`)
        .setLabel(role.name.length > 25 ? role.name.slice(0, 22) + '...' : role.name)
        .setStyle(has ? ButtonStyle.Success : ButtonStyle.Secondary);

      if (currentRow.components.length >= 5) {
        rows.push(currentRow);
        currentRow = new ActionRowBuilder();
      }
      currentRow.addComponents(btn);
    }
    if (currentRow.components.length > 0) {
      rows.push(currentRow);
    }

    const msg = await interaction.reply({ embeds: [embed], components: rows, ephemeral: true, fetchReply: true });

    const collector = msg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120_000,
    });

    collector.on('collect', async (btnInt) => {
      if (btnInt.user.id !== interaction.user.id) {
        return btnInt.reply({ content: '這不是你的選單', ephemeral: true });
      }

      const roleId = btnInt.customId.replace('role_', '');
      const role = interaction.guild.roles.cache.get(roleId);
      if (!role) return btnInt.reply({ content: '身分組已不存在', ephemeral: true });

      const gs = settings.getGuildSettings(interaction.guild.id);
      const selfRoles = gs.selfRoles || [];
      if (!selfRoles.includes(roleId)) return btnInt.reply({ content: '❌ 此身分組已不再允許自助領取', ephemeral: true });

      const me = interaction.guild.members.me;
      if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return btnInt.reply({ content: '❌ 機器人缺少「管理身分組」權限', ephemeral: true });
      if (role.position >= me.roles.highest.position) return btnInt.reply({ content: '❌ 機器人的角色層級不足以管理該身分組', ephemeral: true });
      if (role.managed) return btnInt.reply({ content: '❌ 無法領取託管身分組（如機器人角色）', ephemeral: true });

      const DANGEROUS_PERMS = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.KickMembers, PermissionFlagsBits.BanMembers];
      if (DANGEROUS_PERMS.some(p => role.permissions.has(p))) return btnInt.reply({ content: '❌ 無法自助領取含有管理權限的身分組', ephemeral: true });

      const mem = btnInt.member;
      const has = mem.roles.cache.has(roleId);

      try {
        if (has) {
          await mem.roles.remove(role);
          btnInt.update({
            content: `✅ 已移除 ${role.name}`,
            components: [],
            embeds: [],
          });
        } else {
          await mem.roles.add(role);
          btnInt.update({
            content: `✅ 已為你加入 ${role.name}`,
            components: [],
            embeds: [],
          });
        }
      } catch (err) {
        logger.error(`身分組操作失敗 (${role.name}):`, err);
        btnInt.update({
          content: `❌ ${err.code === 50013 ? '機器人缺少權限（Missing Permissions），請檢查角色層級與管理身分組權限' : '操作失敗：' + err.message}`,
          components: [],
          embeds: [],
        });
      }
    });

    collector.on('end', async () => {
      const expiredEmbed = new EmbedBuilder()
        .setColor(0x888888)
        .setTitle('🎭 選單已過期')
        .setDescription('請重新輸入 `/role` 開啟新選單')
        .setTimestamp();

      await interaction.editReply({ embeds: [expiredEmbed], components: [] }).catch(err => logger.warn('role 編輯回覆失敗:', err.message));
    });
  },
};
