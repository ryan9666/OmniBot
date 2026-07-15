const client = require('./client');
const config = require('./config');
const logger = require('./utils/logger');
const { deploy } = require('./utils/deploy-commands');
const { registerCommands, registerEvents } = require('./utils/command-handler');
const firebase = require('./services/firebase');
const settings = require('./services/settings');
const musicApi = require('./services/music-api');

async function start() {
  await settings.init();
  firebase.init();
  registerCommands(client);
  registerEvents(client);

  await deploy();

  try {
    await client.login(config.discord.token);
    logger.info('Bot 啟動完成');
    musicApi.start();
    if (process.env.ADMIN_PORT || process.env.ADMIN_AUTO_START !== 'false') {
      try {
        const { startAdmin } = require('../admin/server');
        startAdmin(client);
      } catch (err) {
        logger.warn('管理員後臺啟動失敗:', err.message);
      }
    }
  } catch (err) {
    logger.error('登入失敗:', err);
    process.exit(1);
  }
}

start();

process.on('unhandledRejection', (err) => {
  logger.error('未捕捉的 Promise 拒絕:', err);
});
