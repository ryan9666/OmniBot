const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const settings = require('../services/settings');
const raidTracker = require('../services/raid-tracker');
const inviteTracker = require('../services/invite-tracker');

module.exports = {
  async execute(member) {
    const gs = settings.getGuildSettings(member.guild.id);

    if (gs.autoRoleId) {
      const role = member.guild.roles.cache.get(gs.autoRoleId);
      if (role && role.position < member.guild.members.me.roles.highest.position) {
        await member.roles.add(role).catch(err => logger.warn('guildMemberAdd 操作失敗:', err.message));
      }
    }

    if (gs.autoNick?.enabled && gs.autoNick?.template) {
      const roleTemplates = gs.autoNick.roles || {};
      let template = gs.autoNick.template;
      const sortedRoles = [...member.roles.cache.values()]
        .filter(r => roleTemplates[r.id])
        .sort((a, b) => b.position - a.position);
      if (sortedRoles.length > 0) template = roleTemplates[sortedRoles[0].id];
      const daysSince = (date) => Math.floor((Date.now() - date) / 86400000);
      const pad = (n) => String(n).padStart(2, '0');
      const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const highestRole = member.roles.highest.name === '@everyone' ? '' : member.roles.highest.name;
      const nickname = template
        .replace(/{user}/g, member.user.username)
        .replace(/{tag}/g, member.user.tag)
        .replace(/{id}/g, member.id)
        .replace(/{nick}/g, member.user.username)
        .replace(/{count}/g, member.guild.memberCount)
        .replace(/{server}/g, member.guild.name)
        .replace(/{created}/g, fmtDate(member.user.createdAt))
        .replace(/{age}/g, `${daysSince(member.user.createdAt)}天`)
        .replace(/{joined}/g, fmtDate(member.joinedAt || new Date()))
        .replace(/{days}/g, `${daysSince(member.joinedAt || new Date())}天`)
        .replace(/{color}/g, highestRole ? member.roles.highest.hexColor : '')
        .replace(/{boost}/g, member.premiumSince ? '💎' : '')
        .replace(/{role}/g, highestRole)
        .replace(/{random}/g, Math.random().toString(36).slice(2, 6).toUpperCase())
        .slice(0, 32);
      if (nickname && member.roles.highest.position < member.guild.members.me.roles.highest.position) {
        await member.setNickname(nickname).catch(err => logger.warn('guildMemberAdd 自動暱稱失敗:', err.message));
      }
    }

    if (gs.antiRaid?.enabled) {
      raidTracker.trackJoin(member.guild.id);
      const recent = raidTracker.getJoinCount(member.guild.id, (gs.antiRaid.joinWindow || 10) * 1000);
      if (recent >= (gs.antiRaid.joinThreshold || 5)) {
        try {
          if (gs.antiRaid.action === 'kick') await member.kick('防轟炸：大量加入').catch(err => logger.warn('guildMemberAdd 操作失敗:', err.message));
          const logCh = gs.antiRaid.logChannelId ? member.guild.channels.cache.get(gs.antiRaid.logChannelId) : null;
          if (logCh) logCh.send(`🚨 **防轟炸觸發**\n偵測到 ${recent} 人在 ${gs.antiRaid.joinWindow || 10} 秒內加入`);
        } catch { return; }
      }
    }

    const channel = gs.welcome?.channelId ? member.guild.channels.cache.get(gs.welcome.channelId) : null;
    if (channel && gs.welcome?.enabled) {
      const firstRole = gs.selfRoles?.[0] ? member.guild.roles.cache.get(gs.selfRoles[0]) : null;
      const msg = (gs.welcome?.message || `哈囉 {mention}，歡迎來到 {server}！\n👋 目前伺服器總人數：{count}人`)
        .replace(/{mention}/g, `<@${member.id}>`)
        .replace(/{user}/g, member.user.tag)
        .replace(/{server}/g, member.guild.name)
        .replace(/{count}/g, member.guild.memberCount)
        .replace(/{channel}/g, `<#${channel.id}>`)
        .replace(/{role}/g, firstRole ? `<@&${firstRole.id}>` : '@身分組');

      const embed = new EmbedBuilder()
        .setColor(0x5865F2).setTitle('🎉 歡迎加入伺服器').setDescription(msg)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 128 }))
        .setFooter({ text: member.guild.name }).setTimestamp();

      const imageUrl = gs.welcome?.image;
      if (imageUrl) embed.setImage(imageUrl);
      channel.send({ embeds: [embed] }).catch(err => logger.warn('guildMemberAdd 操作失敗:', err.message));
    }

    const logChId = gs.inviteLog?.channelId;
    if (logChId) {
      const logCh = member.guild.channels.cache.get(logChId);
      if (logCh) {
        const result = await inviteTracker.detectJoin(member.guild).catch(() => null);
        await inviteTracker.refresh(member.guild).catch(err => logger.warn('guildMemberAdd 操作失敗:', err.message));
        let text = `✅ ${member.user} 加入了伺服器`;
        if (result) {
          text += `\n來源：邀請連結 | 邀請碼：\`${result.code}\``;
          text += result.inviter ? ` | 邀請者：${result.inviter}` : ' | 邀請者：無邀請者';

          const allInvites = inviteTracker.getCache(member.guild.id);
          const totalUses = result.uses || 0;
          const active = [...allInvites.values()].filter(i => i.code === result.code).reduce((s, i) => s + (i.uses || 0), 0);
          text += `\n累計：${totalUses}，有效：${active}`;
        }
        logCh.send(text).catch(err => logger.warn('guildMemberAdd 操作失敗:', err.message));
      }
    }
  },
};
