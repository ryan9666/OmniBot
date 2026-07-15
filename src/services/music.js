const logger = require('../utils/logger');
const { createAudioPlayer, createAudioResource, joinVoiceChannel, AudioPlayerStatus, entersState } = require('@discordjs/voice');
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const play = require('play-dl');

// Initialize SoundCloud
play.getFreeClientID().then(id => {
  if (id) play.setToken({ soundcloud: { client_id: id } });
}).catch(err => logger.warn('music 操作失敗:', err.message));

const queues = new Map();

class MusicQueue {
  constructor(guildId, channel, textChannel) {
    this.guildId = guildId; this.voiceChannel = channel; this.textChannel = textChannel;
    this.songs = []; this.playing = false; this.loop = false; this.volume = 50;
    this.connection = null; this.player = createAudioPlayer();
  }
}

async function searchSC(query) {
  const results = await play.search(query, { source: { soundcloud: 'tracks' }, limit: 1 }).catch(() => []);
  if (results.length === 0) return null;
  const info = await play.soundcloud(results[0].url).catch(() => null);
  if (!info) return { title: results[0].title || query, url: results[0].url, duration: 0 };
  return { title: info.name, url: info.permalink, duration: info.duration / 1000 };
}

const music = {
  async play(interaction, query) {
    const voice = interaction.member.voice.channel;
    if (!voice) return interaction.reply({ content: '❌ 你不在語音頻道中', ephemeral: true });
    const perms = voice.permissionsFor(interaction.client.user);
    if (!perms.has(PermissionFlagsBits.Connect) || !perms.has(PermissionFlagsBits.Speak)) return interaction.reply({ content: '❌ 機器人沒有權限加入/發聲', ephemeral: true });
    await interaction.deferReply();

    let guildQueue = queues.get(interaction.guild.id);
    if (!guildQueue) { guildQueue = new MusicQueue(interaction.guild.id, voice, interaction.channel); queues.set(interaction.guild.id, guildQueue); }
    if (guildQueue.voiceChannel.id !== voice.id) return interaction.editReply({ content: '❌ 機器人已在其他語音頻道' });

    const song = await searchSC(query);
    if (!song) return interaction.editReply('❌ 找不到結果');

    guildQueue.songs.push(song);
    if (!guildQueue.playing) playSong(guildQueue);

    const embed = new EmbedBuilder()
      .setColor(0xff7700).setTitle('🎵 已加入佇列')
      .setDescription(song.title)
      .setFooter({ text: `位置 #${guildQueue.songs.length} • SoundCloud` });
    await interaction.editReply({ embeds: [embed] });
  },

  skip(i) { const gq = queues.get(i.guild.id); if (!gq || !gq.playing) return i.reply({ content: '❌ 沒有播放中的音樂', ephemeral: true }); gq.player.stop(); return i.reply({ content: '⏭️ 已跳過', ephemeral: true }); },
  stop(i) { const gq = queues.get(i.guild.id); if (!gq) return i.reply({ content: '❌ 沒有播放中的音樂', ephemeral: true }); gq.songs = []; gq.player.stop(); gq.connection?.destroy(); queues.delete(i.guild.id); return i.reply({ content: '⏹️ 已停止', ephemeral: true }); },
  np(i) { const gq = queues.get(i.guild.id); if (!gq || !gq.playing || !gq.songs[0]) return i.reply({ content: '❌ 沒有播放中的音樂', ephemeral: true }); return i.reply({ embeds: [new EmbedBuilder().setColor(0xff7700).setTitle('🎵 正在播放').setDescription(gq.songs[0].title)], ephemeral: true }); },
  queue(i) { const gq = queues.get(i.guild.id); if (!gq || gq.songs.length === 0) return i.reply({ content: '❌ 佇列為空', ephemeral: true }); return i.reply({ embeds: [new EmbedBuilder().setColor(0xff7700).setTitle('🎶 播放佇列').setDescription(gq.songs.map((s, idx) => `${idx === 0 ? '▶️' : `${idx}.`} ${s.title}`).slice(0, 10).join('\n'))], ephemeral: true }); },
  pause(i) { const gq = queues.get(i.guild.id); if (!gq || !gq.playing) return i.reply({ content: '❌ 沒有播放中的音樂', ephemeral: true }); gq.player.pause(); return i.reply({ content: '⏸️ 已暫停', ephemeral: true }); },
  resume(i) { const gq = queues.get(i.guild.id); if (!gq) return i.reply({ content: '❌ 沒有暫停中的音樂', ephemeral: true }); gq.player.unpause(); return i.reply({ content: '▶️ 已繼續', ephemeral: true }); },
  volume(i, vol) { const gq = queues.get(i.guild.id); if (!gq || !gq.playing) return i.reply({ content: '❌ 沒有播放中的音樂', ephemeral: true }); gq.volume = Math.max(0, Math.min(100, vol)); gq.player.state.resource?.volume?.setVolumeLogarithmic(gq.volume / 100); return i.reply({ content: `🔊 ${gq.volume}%`, ephemeral: true }); },
  loop(i) { const gq = queues.get(i.guild.id); if (!gq) return i.reply({ content: '❌ 沒有播放中的音樂', ephemeral: true }); gq.loop = !gq.loop; return i.reply({ content: `🔁 ${gq.loop ? '啟用' : '停用'}`, ephemeral: true }); },
};

async function playSong(queue) {
  queue.playing = true;
  if (!queue.connection) {
    queue.connection = joinVoiceChannel({ channelId: queue.voiceChannel.id, guildId: queue.guildId, adapterCreator: queue.voiceChannel.guild.voiceAdapterCreator });
    queue.connection.subscribe(queue.player);
  }
  const song = queue.songs[0];
  if (!song) { queue.playing = false; return; }

  try {
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, { inputType: stream.type, inlineVolume: true });
    resource.volume?.setVolumeLogarithmic(queue.volume / 100);
    queue.player.play(resource);
    if (queue.textChannel) queue.textChannel.send({ embeds: [new EmbedBuilder().setColor(0xff7700).setTitle('▶️ 正在播放').setDescription(song.title).setFooter({ text: 'SoundCloud' })] }).catch(err => logger.warn('music 操作失敗:', err.message));
  } catch (err) {
    logger.error('音樂 播放失敗:', err.message);
    queue.songs.shift();
    if (queue.songs.length > 0) playSong(queue);
    else { queue.playing = false; queue.connection?.destroy(); queues.delete(queue.guildId); }
    return;
  }

  queue.player.removeAllListeners(AudioPlayerStatus.Idle);
  queue.player.on(AudioPlayerStatus.Idle, () => {
    if (queue.loop) queue.songs.push(queue.songs.shift()); else queue.songs.shift();
    if (queue.songs.length > 0) playSong(queue);
    else { queue.playing = false; setTimeout(() => { queue.connection?.destroy(); queues.delete(queue.guildId); }, 60000); if (queue.textChannel) queue.textChannel.send('🎵 佇列已播放完畢').catch(err => logger.warn('music 操作失敗:', err.message)); }
  });

  queue.player.removeAllListeners('error');
  queue.player.on('error', (err) => { logger.error('音樂 錯誤:', err.message); if (queue.textChannel) queue.textChannel.send('❌ 播放錯誤').catch(err => logger.warn('music 操作失敗:', err.message)); });
}

music.getQueue = (guildId) => queues.get(guildId);
music.queues = queues;

music.playFromWeb = async (guildId, channelId, query, userId) => {
  const guild = global.client?.guilds.cache.get(guildId);
  if (!guild) throw new Error('找不到伺服器');
  const voiceChannel = guild.channels.cache.get(channelId);
  if (!voiceChannel) throw new Error('找不到語音頻道');

  let guildQueue = queues.get(guildId);
  if (!guildQueue) {
    guildQueue = new MusicQueue(guildId, voiceChannel, null);
    queues.set(guildId, guildQueue);
  }

  const song = await searchSC(query);
  if (!song) throw new Error('找不到結果');

  guildQueue.songs.push(song);
  if (!guildQueue.playing) playSong(guildQueue);
  return song;
};

module.exports = music;
