const logger = require('../utils/logger');
const settings = require('../services/settings');

module.exports = {
  async execute(message) {
    if (!message.guild) return;
    if (message.partial) {
      try { await message.fetch(); } catch { return; }
    }

    const gs = settings.getGuildSettings(message.guild.id);
    const channelId = gs.messageLog?.channelId;
    if (!channelId) return;

    const logChannel = message.guild.channels.cache.get(channelId);
    if (!logChannel) return;

    const authorTag = message.author?.tag || '未知使用者';
    const authorId = message.author?.id || '?';
    const avatar = message.author?.displayAvatarURL() || '';
    const content = message.content ? `\`\`\`${message.content.slice(0, 500)}\`\`\`` : '（訊息未緩存，無法取得內容）';

    logChannel.send({
      embeds: [{
        color: 0xef4444,
        author: { name: authorTag, icon_url: avatar },
        description: `🗑️ 訊息已在 <#${message.channel.id}> 被刪除\n${content}`,
        footer: { text: `作者ID: ${authorId}` },
        timestamp: new Date().toISOString(),
      }],
    }).catch(err => logger.warn('messageDelete 日誌傳送失敗:', err.message));
  },
};
