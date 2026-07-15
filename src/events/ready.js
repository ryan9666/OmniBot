const logger = require('../utils/logger');
const inviteTracker = require('../services/invite-tracker');
const counterService = require('../services/counter-service');
const settings = require('../services/settings');

async function checkTempBans(client) {
  try {
    const data = settings.load();
    for (const [guildId, gs] of Object.entries(data)) {
      if (!gs.tempBans) continue;
      const guild = client.guilds.cache.get(guildId);
      if (!guild) continue;
      for (const [userId, info] of Object.entries(gs.tempBans)) {
        if (Date.now() >= info.expiresAt) {
          try {
            await guild.bans.remove(userId, '臨時封鎖到期，自動解封');
            logger.info(`${userId} 在 ${guild.name} 的臨時封鎖已到期，已自動解封`);
          } catch (err) {
            logger.warn(`自動解封 ${userId} 失敗: ${err.message}`);
          }
          delete gs.tempBans[userId];
          settings.updateGuildSettings(guildId, gs);
        }
      }
    }
  } catch (err) {
    logger.error('檢查臨時封鎖失敗:', err.message);
  }
}

module.exports = {
  once: true,
  async execute(client) {
    logger.info(`已登入為 ${client.user.tag}`);
    const guilds = [...client.guilds.cache.values()];
    const results = await Promise.allSettled(guilds.map(g => inviteTracker.refresh(g)));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    logger.info(`邀請快取已初始化: ${ok}/${guilds.length} 個伺服器成功`);
    counterService.init(client);
    logger.info('計數器服務已啟動');

    await checkTempBans(client);
    setInterval(() => checkTempBans(client), 60000);
    logger.info('臨時封鎖檢查服務已啟動');
  },
};
