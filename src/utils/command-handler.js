const fs = require('fs');
const path = require('path');
const logger = require('./logger');

function registerCommands(client) {
  const commandsPath = path.join(__dirname, '..', 'commands');
  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.js'));

    for (const file of files) {
      const command = require(path.join(categoryPath, file));
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
      } else {
        logger.warn(`指令 ${file} 缺少 data 或 execute 屬性`);
      }
    }
  }

  logger.info(`已載入 ${client.commands.size} 個指令`);
}

function registerEvents(client) {
  const eventsPath = path.join(__dirname, '..', 'events');
  const files = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

  for (const file of files) {
    const event = require(path.join(eventsPath, file));
    let eventName = file.replace('.js', '');
    eventName = eventName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

    if (event.once) {
      client.once(eventName, (...args) => event.execute(...args));
    } else {
      client.on(eventName, (...args) => event.execute(...args));
    }
  }

  logger.info(`已註冊 ${files.length} 個事件監聽器`);
}

module.exports = { registerCommands, registerEvents };
