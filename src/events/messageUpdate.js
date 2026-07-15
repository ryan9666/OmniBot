const logger = require('../utils/logger');
const settings = require('../services/settings');

module.exports = {
  async execute(oldMessage, newMessage) {
    if (newMessage.author?.bot) return;
    if (!newMessage.guild) return;
    if (newMessage.partial) {
      try { await newMessage.fetch(); } catch { return; }
    }
    if (oldMessage.partial) {
      try { await oldMessage.fetch(); } catch { /* partial data ok */ }
    }
    if (oldMessage.content === newMessage.content) return;

    const gs = settings.getGuildSettings(newMessage.guild.id);
    const channelId = gs.messageLog?.channelId;
    if (!channelId) return;

    const logChannel = newMessage.guild.channels.cache.get(channelId);
    if (!logChannel) return;

    const oldContent = oldMessage.content?.slice(0, 500) || '（無法取得）';
    const newContent = newMessage.content?.slice(0, 500) || '（無法取得）';

    logChannel.send({
      embeds: [{
        color: 0xf59e0b,
        author: { name: newMessage.author.tag, icon_url: newMessage.author.displayAvatarURL() },
        description: `✏️ 訊息在 <#${newMessage.channel.id}> 被編輯\n[跳轉](${newMessage.url})`,
        fields: [
          { name: '編輯前', value: `\`\`\`${oldContent}\`\`\`` },
          { name: '編輯後', value: `\`\`\`${newContent}\`\`\`` },
        ],
        footer: { text: `作者ID: ${newMessage.author.id}` },
        timestamp: new Date().toISOString(),
      }],
    }).catch(err => logger.warn('messageUpdate 日誌傳送失敗:', err.message));
  },
};
