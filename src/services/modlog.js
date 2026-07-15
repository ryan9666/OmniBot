const { EmbedBuilder } = require('discord.js');
const logger = require('../utils/logger');
const settings = require('./settings');

async function logModAction(guild, action, target, moderator, reason, extra) {
  const gs = settings.getGuildSettings(guild.id);
  const channelId = gs.modLog?.channelId;
  if (!channelId) return;

  const channel = guild.channels.cache.get(channelId);
  if (!channel) return;

  const colors = {
    ban: 0xff0000, tempban: 0xff4400, kick: 0xffa500,
    timeout: 0xffff00, warn: 0xffcc00, clear: 0x00ff00, forceunmute: 0x00ff00, lockdown: 0xef4444,
  };

  const embed = new EmbedBuilder()
    .setColor(colors[action] || 0x0099ff)
    .setTitle(`🛡️ 管理操作記錄`)
    .addFields(
      { name: '操作', value: action, inline: true },
      { name: '對象', value: `${target.tag} (<@${target.id}>)`, inline: true },
      { name: '執行者', value: moderator.tag, inline: true },
      { name: '原因', value: reason || '未提供', inline: false },
    )
    .setTimestamp();

  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      embed.addFields({ name: k, value: String(v), inline: true });
    }
  }

  await channel.send({ embeds: [embed] }).catch(err => logger.warn('modlog 傳送失敗:', err.message));
}

module.exports = { logModAction };
