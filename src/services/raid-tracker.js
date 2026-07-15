const MAX_WINDOW = 120000;

const joins = {};
const messages = {};
const lastContents = {};

function clean() {
  const now = Date.now();
  for (const gid of Object.keys(joins)) {
    joins[gid] = joins[gid].filter(t => now - t < MAX_WINDOW);
    if (joins[gid].length === 0) delete joins[gid];
  }
  for (const gid of Object.keys(messages)) {
    for (const uid of Object.keys(messages[gid])) {
      messages[gid][uid] = messages[gid][uid].filter(t => now - t < MAX_WINDOW);
      if (messages[gid][uid].length === 0) delete messages[gid][uid];
    }
    if (Object.keys(messages[gid]).length === 0) delete messages[gid];
  }
  for (const gid of Object.keys(lastContents)) {
    for (const uid of Object.keys(lastContents[gid])) {
      lastContents[gid][uid] = lastContents[gid][uid].filter(h => now - h.time < MAX_WINDOW);
      if (lastContents[gid][uid].length === 0) delete lastContents[gid][uid];
    }
    if (Object.keys(lastContents[gid]).length === 0) delete lastContents[gid];
  }
}

setInterval(clean, 60000);

module.exports = {
  trackJoin(guildId) {
    if (!joins[guildId]) joins[guildId] = [];
    joins[guildId].push(Date.now());
    return joins[guildId].length;
  },

  trackMessage(guildId, userId) {
    if (!messages[guildId]) messages[guildId] = {};
    if (!messages[guildId][userId]) messages[guildId][userId] = [];
    messages[guildId][userId].push(Date.now());
    return messages[guildId][userId].length;
  },

  checkDuplicate(guildId, userId, content, windowMs = 5000) {
    if (!lastContents[guildId]) lastContents[guildId] = {};
    if (!lastContents[guildId][userId]) lastContents[guildId][userId] = [];
    const history = lastContents[guildId][userId];
    history.push({ content, time: Date.now() });
    if (history.length > 20) history.shift();
    const recent = history.filter(h => Date.now() - h.time < windowMs);
    const count = recent.filter(h => h.content === content).length;
    return count;
  },

  getJoinCount(guildId, windowMs) {
    const now = Date.now();
    return (joins[guildId] || []).filter(t => now - t < windowMs).length;
  },

  getSpamCount(guildId, userId, windowMs) {
    const now = Date.now();
    return (messages[guildId]?.[userId] || []).filter(t => now - t < windowMs).length;
  },
};
