const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const logger = require('../../utils/logger');
const settings = require('../../services/settings');

function applyTemplate(template, member, guild) {
  const daysSince = (date) => Math.floor((Date.now() - date) / 86400000);
  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const highestRole = member.roles.highest.name === '@everyone' ? '' : member.roles.highest.name;
  return template
    .replace(/{user}/g, member.user.username)
    .replace(/{tag}/g, member.user.tag)
    .replace(/{id}/g, member.id)
    .replace(/{nick}/g, member.nickname || member.user.username)
    .replace(/{count}/g, guild.memberCount)
    .replace(/{server}/g, guild.name)
    .replace(/{created}/g, fmtDate(member.user.createdAt))
    .replace(/{age}/g, `${daysSince(member.user.createdAt)}天`)
    .replace(/{joined}/g, fmtDate(member.joinedAt || new Date()))
    .replace(/{days}/g, `${daysSince(member.joinedAt || new Date())}天`)
    .replace(/{color}/g, highestRole ? member.roles.highest.hexColor : '')
    .replace(/{boost}/g, member.premiumSince ? '💎' : '')
    .replace(/{role}/g, highestRole)
    .replace(/{random}/g, Math.random().toString(36).slice(2, 6).toUpperCase());
}

function getTemplateForMember(gs, member) {
  if (!gs.autoNick?.enabled || !gs.autoNick?.template) return null;
  const roleTemplates = gs.autoNick.roles || {};
  const sortedRoles = [...member.roles.cache.values()]
    .filter(r => roleTemplates[r.id])
    .sort((a, b) => b.position - a.position);
  if (sortedRoles.length > 0) return roleTemplates[sortedRoles[0].id];
  return gs.autoNick.template;
}

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('暱稱系統管理')
    .addSubcommandGroup(group =>
      group.setName('template')
        .setDescription('管理暱稱格式')
        .addSubcommand(sub =>
          sub.setName('set')
            .setDescription('設定預設暱稱格式（可用 {user} {tag} {id} {count} {server}）')
            .addStringOption(opt => opt.setName('格式').setDescription('例如：咕嘎 {user}').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('role')
            .setDescription('設定特定身分組的暱稱格式（優先於預設格式）')
            .addRoleOption(opt => opt.setName('身分組').setDescription('目標身分組').setRequired(true))
            .addStringOption(opt => opt.setName('格式').setDescription('例如：💎 {user}').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('roleremove')
            .setDescription('移除身分組的暱稱格式')
            .addRoleOption(opt => opt.setName('身分組').setDescription('目標身分組').setRequired(true)))
        .addSubcommand(sub =>
          sub.setName('remove')
            .setDescription('移除暱稱格式設定'))
        .addSubcommand(sub =>
          sub.setName('toggle')
            .setDescription('啟用/停用自動暱稱'))
        .addSubcommand(sub =>
          sub.setName('status')
            .setDescription('查看目前暱稱格式設定')))
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('設定單一成員暱稱')
        .addUserOption(opt => opt.setName('成員').setDescription('目標成員').setRequired(true))
        .addStringOption(opt => opt.setName('名稱').setDescription('新暱稱（不填則重設）').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('apply')
        .setDescription('將目前格式套用到所有成員'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),
  async execute(interaction) {
    const group = interaction.options.getSubcommandGroup();
    const sub = interaction.options.getSubcommand();
    const gs = settings.getGuildSettings(interaction.guild.id);

    if (group === 'template') {
      if (sub === 'set') {
        const template = interaction.options.getString('格式');
        if (!gs.autoNick) gs.autoNick = { enabled: false, template: '', roles: {} };
        gs.autoNick.template = template;
        gs.autoNick.enabled = true;
        settings.updateGuildSettings(interaction.guild.id, gs);
        return interaction.reply({ content: `✅ 預設暱稱格式已設為：\`${template}\`\n可用變數：\`{user}\` 名稱、\`{tag}\` 標籤、\`{id}\` ID、\`{nick}\` 當前暱稱、\`{count}\` 人數、\`{server}\` 伺服器、\`{created}\` 建立日、\`{age}\` 帳號年齡、\`{joined}\` 加入日、\`{days}\` 加入天數、\`{color}\` 角色顏色、\`{boost}\` 💎、\`{role}\` 最高身分組、\`{random}\` 亂數`, ephemeral: true });
      }

      if (sub === 'role') {
        const role = interaction.options.getRole('身分組');
        const template = interaction.options.getString('格式');
        if (!gs.autoNick) gs.autoNick = { enabled: false, template: '', roles: {} };
        if (!gs.autoNick.roles) gs.autoNick.roles = {};
        gs.autoNick.roles[role.id] = template;
        gs.autoNick.enabled = true;
        settings.updateGuildSettings(interaction.guild.id, gs);
        return interaction.reply({ content: `✅ 身分組 ${role} 的暱稱格式已設為：\`${template}\``, ephemeral: true });
      }

      if (sub === 'roleremove') {
        const role = interaction.options.getRole('身分組');
        if (gs.autoNick?.roles?.[role.id]) {
          delete gs.autoNick.roles[role.id];
          settings.updateGuildSettings(interaction.guild.id, gs);
          return interaction.reply({ content: `✅ 已移除 ${role} 的暱稱格式`, ephemeral: true });
        }
        return interaction.reply({ content: `❌ ${role} 沒有設定暱稱格式`, ephemeral: true });
      }

      if (sub === 'remove') {
        if (!gs.autoNick) gs.autoNick = { enabled: false, template: '', roles: {} };
        gs.autoNick.template = '';
        gs.autoNick.enabled = false;
        gs.autoNick.roles = {};
        settings.updateGuildSettings(interaction.guild.id, gs);
        return interaction.reply({ content: '✅ 已移除所有暱稱格式設定', ephemeral: true });
      }

      if (sub === 'toggle') {
        if (!gs.autoNick) gs.autoNick = { enabled: false, template: '', roles: {} };
        gs.autoNick.enabled = !gs.autoNick.enabled;
        settings.updateGuildSettings(interaction.guild.id, gs);
        return interaction.reply({ content: `✅ 自動暱稱已${gs.autoNick.enabled ? '啟用' : '停用'}`, ephemeral: true });
      }

      if (sub === 'status') {
        if (!gs.autoNick || !gs.autoNick.template) {
          return interaction.reply({ content: '❌ 未設定暱稱格式', ephemeral: true });
        }
        const roleEntries = Object.entries(gs.autoNick.roles || {});
        let msg = `**📋 暱稱格式設定**\n狀態：${gs.autoNick.enabled ? '✅ 啟用' : '❌ 停用'}\n預設格式：\`${gs.autoNick.template}\``;
        if (roleEntries.length > 0) {
          msg += '\n\n**身分組專用格式：**';
          for (const [roleId, tmpl] of roleEntries) {
            const role = interaction.guild.roles.cache.get(roleId);
            msg += `\n${role || '已刪除的身分組'}：\`${tmpl}\``;
          }
        }
        return interaction.reply({ content: msg, ephemeral: true });
      }
    }

    if (sub === 'set') {
      const target = interaction.options.getMember('成員');
      if (!target) return interaction.reply({ content: '找不到該成員', ephemeral: true });
      if (target.id === interaction.client.user.id) return interaction.reply({ content: '❌ 無法修改機器人暱稱', ephemeral: true });
      if (target.id === interaction.guild.ownerId) return interaction.reply({ content: '❌ 無法修改伺服器擁有者暱稱', ephemeral: true });
      if (target.roles.highest.position >= interaction.member.roles.highest.position && interaction.member.id !== interaction.guild.ownerId) {
        return interaction.reply({ content: '❌ 你的身分組層級不足以修改該成員暱稱', ephemeral: true });
      }
      if (target.roles.highest.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({ content: '❌ 機器人的身分組層級不足以修改該成員暱稱', ephemeral: true });
      }
      const nickname = interaction.options.getString('名稱');
      try {
        await target.setNickname(nickname);
        await interaction.reply({ content: `✅ ${nickname ? `已將 ${target.user.tag} 的暱稱設為：${nickname}` : `已重設 ${target.user.tag} 的暱稱`}`, ephemeral: true });
      } catch (err) {
        logger.error(`nick set 失敗:`, err.message);
        await interaction.reply({ content: '❌ 暱稱設定失敗，請檢查機器人權限', ephemeral: true });
      }
      return;
    }

    if (sub === 'apply') {
      if (!gs.autoNick?.template) return interaction.reply({ content: '❌ 請先設定暱稱格式（/nick template set）', ephemeral: true });
      if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageNicknames)) {
        return interaction.reply({ content: '❌ 機器人缺少管理暱稱權限', ephemeral: true });
      }
      await interaction.deferReply({ ephemeral: true });
      await interaction.guild.members.fetch();
      const members = [...interaction.guild.members.cache.values()];
      let success = 0;
      let fail = 0;
      const tasks = members.map(async (member) => {
        if (member.id === interaction.client.user.id) return;
        if (member.id === interaction.guild.ownerId) return;
        if (member.roles.highest.position >= interaction.guild.members.me.roles.highest.position) return;
        const template = getTemplateForMember(gs, member);
        if (!template) return;
        const nickname = applyTemplate(template, member, interaction.guild).slice(0, 32);
        try {
          await member.setNickname(nickname);
          success++;
        } catch { fail++; }
      });
      await Promise.allSettled(tasks);
      await interaction.editReply({ content: `✅ 暱稱套用完成\n已更新：${success} 人\n失敗：${fail} 人` });
    }
  },
};
