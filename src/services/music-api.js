const express = require('express');
const music = require('./music');
const logger = require('../utils/logger');

const app = express();
const PORT = process.env.MUSIC_API_PORT || 3001;

app.use(express.json());

app.get('/api/music/:guildId', (req, res) => {
  const queue = music.queues.get(req.params.guildId);
  if (!queue) {
    return res.json({ playing: false, songs: [] });
  }
  res.json({
    playing: queue.playing,
    loop: queue.loop,
    volume: queue.volume,
    currentSong: queue.songs[0] || null,
    nextSong: queue.songs[1] || null,
    queueLength: queue.songs.length,
    historyLength: queue.history.length,
    currentTime: queue.player.state.resource ? Math.floor(queue.player.state.resource.playbackDuration / 1000) : 0,
  });
});

app.post('/api/music/:guildId/control', (req, res) => {
  const queue = music.queues.get(req.params.guildId);
  if (!queue) return res.status(404).json({ error: 'No active queue' });

  const { action, value } = req.body;
  switch (action) {
    case 'toggle':
      if (queue.player.state.status === 'paused') queue.player.unpause();
      else queue.player.pause();
      break;
    case 'skip':
      queue.player.stop();
      break;
    case 'loop':
      queue.loop = !queue.loop;
      break;
    case 'volume':
      queue.volume = Math.max(0, Math.min(100, parseInt(value) || 0));
      if (queue.player.state.resource?.volume) {
        queue.player.state.resource.volume.setVolumeLogarithmic(queue.volume / 100);
      }
      break;
    default:
      return res.status(400).json({ error: 'Unknown action' });
  }
  res.json({ ok: true });
});

app.get('/api/guilds', (req, res) => {
  const guildIds = Array.from(music.queues.keys());
  res.json(guildIds);
});

function start() {
  app.listen(PORT, () => {
    logger.info(`音樂 API 服務已啟動: http://localhost:${PORT}`);
  });
}

module.exports = { start, app };
