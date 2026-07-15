const logger = require('../utils/logger');
const settings = require('./settings');

let client = null;

function init(c) {
  client = c;
  setInterval(updateAll, 300000);
  setTimeout(updateAll, 5000);
}

async function updateAll() {
  if (!client) return;
  for (const [, guild] of client.guilds.cache) {
    const gs = settings.getGuildSettings(guild.id);
    if (!gs.counters || Object.keys(gs.counters).length === 0) continue;
    await guild.members.fetch().catch(err => logger.warn('counterService 操作失敗:', err.message));
    const total = guild.memberCount;
    const online = guild.members.cache.filter(m => m.presence?.status === 'online' || m.presence?.status === 'idle' || m.presence?.status === 'dnd').size;
    for (const [, cfg] of Object.entries(gs.counters)) {
      const channel = guild.channels.cache.get(cfg.channelId);
      if (!channel) continue;
      const count = cfg.type === 'members' ? total : online;
      const name = cfg.type === 'members' ? `👥 成員：${count}` : `📶 在線：${count}`;
      if (channel.name !== name) channel.setName(name).catch(err => logger.warn('counterService 操作失敗:', err.message));
    }
  }
}

module.exports = { init };
