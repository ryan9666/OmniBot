const { PermissionFlagsBits } = require('discord.js');

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
const logger = require('../utils/logger');
const settings = require('../services/settings');

module.exports = {
  async execute(interaction) {
    if (interaction.isButton() && interaction.customId.startsWith('role_toggle_')) {
      return handleRoleToggle(interaction);
    }
    if (interaction.isButton() && interaction.customId === 'ticket_open') {
      return handleTicketCreate(interaction);
    }
    if (interaction.isButton() && interaction.customId === 'ticket_close') {
      return handleTicketClose(interaction);
    }
    if (interaction.isButton() && interaction.customId.startsWith('music_')) {
      return handleMusicButton(interaction);
    }
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command) return;

    const { cooldowns } = interaction.client;
    if (!cooldowns.has(command.data.name)) cooldowns.set(command.data.name, new Map());
    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown || 3) * 1000;

    if (timestamps.has(interaction.user.id)) {
      const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
      if (now < expirationTime) {
        return interaction.reply({ content: `請稍等 ${((expirationTime - now) / 1000).toFixed(1)} 秒後再使用此指令`, ephemeral: true });
      }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    try { await command.execute(interaction); }
    catch (err) {
      logger.error(`執行指令 ${interaction.commandName} 時發生錯誤:`, err);
      const reply = { content: '執行指令時發生錯誤，請稍後再試', ephemeral: true };
      if (interaction.replied || interaction.deferred) { await interaction.followUp(reply); }
      else { await interaction.reply(reply); }
    }
  },
};

async function handleTicketClose(interaction) {
  if (!interaction.channel.name.startsWith('ticket-')) {
    return interaction.reply({ content: '❌ 這不是工單頻道', ephemeral: true });
  }
  const gs = settings.getGuildSettings(interaction.guild.id);
  const ticketRoles = gs.ticket?.roleIds || [];
  const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || interaction.member.roles.cache.some(r => (gs.adminRoles?.topIds || []).includes(r.id));
  const hasRole = ticketRoles.length === 0 || interaction.member.roles.cache.some(r => ticketRoles.includes(r.id));
  if (!isAdmin && !hasRole) return interaction.reply({ content: '❌ 只有管理員可以關閉工單', ephemeral: true });

  await interaction.reply({ content: '🔒 正在備份工單記錄...', ephemeral: false });
  const channel = interaction.channel;

  try {
    let allMessages = [];
    let lastId;
    while (true) {
      const fetched = await channel.messages.fetch({ limit: 100, before: lastId }).catch(() => null);
      if (!fetched || fetched.size === 0) break;
        allMessages = [...allMessages, ...fetched.values()];
      lastId = fetched.last()?.id;
      if (fetched.size < 100) break;
    }

    const msgs = allMessages.reverse();

    const html = `<!DOCTYPE html><html lang="zh-TW"><head><meta charset="UTF-8"><title>工單記錄 - ${escapeHTML(channel.name)}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#313338;color:#dbdee1;padding:24px;max-width:800px;margin:0 auto}h1{font-size:20px;color:#fff;margin-bottom:4px}.meta{font-size:12px;color:#888;margin-bottom:24px}.msg{display:flex;gap:12px;margin-bottom:16px}.msg .avatar{width:40px;height:40px;border-radius:50%;background:#5865F2;flex-shrink:0}.msg .name{font-size:14px;font-weight:600;color:#fff}.msg .time{font-size:10px;color:#888;margin-left:8px}.msg .content{font-size:14px;color:#dbdee1;margin-top:2px;line-height:1.4;word-break:break-word}.system{text-align:center;font-size:12px;color:#888;padding:8px;margin:8px 0;border-top:1px solid #40444b;border-bottom:1px solid #40444b}
</style></head><body><h1>🎫 ${escapeHTML(channel.name)}</h1><div class="meta">📅 ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</div>
${msgs.map(m => {
  if (m.author.id === interaction.client.user.id && m.content.startsWith('<@')) return '';
  const avatar = m.author.displayAvatarURL({ format: 'png', size: 32 });
  const color = m.member?.displayHexColor || '#5865F2';
  return `<div class="msg"><img class="avatar" src="${avatar}" style="background:${color}"><div><div class="name">${escapeHTML(m.author.username)} <span class="time">${m.createdAt.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</span></div><div class="content">${escapeHTML(m.content || '') || '(附件)'}${m.attachments.size ? '<br>📎 '+[...m.attachments.values()].map(a => `<a href="${escapeHTML(a.url)}" style="color:#00a8fc">${escapeHTML(a.name)}</a>`).join(', ') : ''}</div></div></div>`;
}).join('')}
<hr style="border:none;border-top:1px solid #40444b;margin:24px 0"><div class="system">✅ 工單關閉 · ${escapeHTML(interaction.user.tag)} · ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</div>
</body></html>`;

    const logChId = gs.ticket?.channelId;
    if (logChId) {
      const logCh = interaction.guild.channels.cache.get(logChId);
      if (logCh) {
        const { AttachmentBuilder } = require('discord.js');
        const attachment = new AttachmentBuilder(Buffer.from(html), { name: `ticket-${channel.name}.html` });
        await logCh.send({ content: `📁 工單備份: ${channel.name}（關閉者: ${interaction.user.tag}）`, files: [attachment] });
      }
    }
  } catch (err) { logger.error('工單備份失敗:', err.message); }

  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

async function handleTicketCreate(interaction) {
  try {
    const gs = settings.getGuildSettings(interaction.guild.id);
    const ticketConfig = gs.ticket || {};
    const categoryId = ticketConfig.categoryId;
    const roleIds = Array.isArray(ticketConfig.roleIds) ? ticketConfig.roleIds : [];

    const ticketNumber = Date.now().toString(36).slice(-4);
    const channelName = `ticket-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}-${ticketNumber}`;

    const permissionOverwrites = [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
    ];
    for (const rid of roleIds) {
      if (rid && rid !== interaction.guild.roles.everyone.id) {
        permissionOverwrites.push({
          id: rid,
          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
        });
      }
    }

    const channel = await interaction.guild.channels.create({
      name: channelName, type: 0, parent: categoryId || null,
      permissionOverwrites,
    });

    const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
    const embed = new EmbedBuilder()
      .setColor(0x5865F2).setTitle(`🎫 ${interaction.user.username} 的工單`)
      .setDescription('管理員即將為你處理，請描述你的問題。').setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ticket_close').setLabel('🔒 關閉工單').setStyle(ButtonStyle.Danger)
    );

    await channel.send({ content: `<@${interaction.user.id}>`, embeds: [embed], components: [row] });
    await interaction.reply({ content: `✅ 已建立工單 ${channel}`, ephemeral: true });
  } catch (err) {
    logger.error('建立工單失敗:', err);
    await interaction.reply({ content: '❌ 建立工單失敗', ephemeral: true });
  }
}

async function handleRoleToggle(interaction) {
  const [, , guildId, roleId] = interaction.customId.split('_');
  if (interaction.guild.id !== guildId) return interaction.reply({ content: '此按鈕不屬於此伺服器', ephemeral: true });

  const role = interaction.guild.roles.cache.get(roleId);
  if (!role) return interaction.reply({ content: '身分組已不存在', ephemeral: true });

  const gs = settings.getGuildSettings(interaction.guild.id);
  const selfRoles = gs.selfRoles || [];
  if (!selfRoles.includes(roleId)) return interaction.reply({ content: '❌ 此身分組已不再允許自助領取', ephemeral: true });

  const me = interaction.guild.members.me;
  if (!me.permissions.has('ManageRoles')) return interaction.reply({ content: '❌ 機器人缺少「管理身分組」權限', ephemeral: true });
  if (role.position >= me.roles.highest.position) return interaction.reply({ content: '❌ 機器人的角色層級不足以管理該身分組', ephemeral: true });
  if (role.managed) return interaction.reply({ content: '❌ 無法領取託管身分組（如機器人角色）', ephemeral: true });

  const DANGEROUS_PERMS = ['Administrator', 'ManageRoles', 'ManageGuild', 'ManageChannels', 'KickMembers', 'BanMembers'];
  if (DANGEROUS_PERMS.some(p => role.permissions.has(p))) return interaction.reply({ content: '❌ 無法自助領取含有管理權限的身分組', ephemeral: true });

  const member = interaction.member;
  const has = member.roles.cache.has(roleId);
  try {
    if (has) { await member.roles.remove(role); await interaction.reply({ content: `✅ 已移除 ${role.name}`, ephemeral: true }); }
    else {
      const gs = settings.getGuildSettings(interaction.guild.id);
      for (const group of (gs.roleGroups || [])) {
        if (!group.roles?.includes(roleId)) continue;
        const memberGroupRoles = member.roles.cache.filter(r => group.roles.includes(r.id) && r.id !== roleId);
        if (group.is_mutually_exclusive && memberGroupRoles.size > 0) {
          await member.roles.remove(memberGroupRoles.first().id);
        }
        if (!group.is_mutually_exclusive && group.max_selectable_limit > 0) {
          if (memberGroupRoles.size >= group.max_selectable_limit) {
            return interaction.reply({ content: `❌ 已達此群組領取上限 (${group.max_selectable_limit} 個)`, ephemeral: true });
          }
        }
      }
      await member.roles.add(role);
      await interaction.reply({ content: `✅ 已為你加入 ${role.name}`, ephemeral: true });
    }
  } catch (err) {
    logger.error(`身分組操作失敗 (${role.name}):`, err);
    await interaction.reply({ content: `❌ ${err.code === 50013 ? '機器人缺少權限' : '操作失敗：' + err.message}`, ephemeral: true });
  }
}

async function handleMusicButton(interaction) {
  const music = require('../services/music');
  const queue = music.queues.get(interaction.guild.id);
  
  if (!queue || !queue.playing) {
    return interaction.reply({ content: '❌ 當前沒有播放中的音樂佇列', ephemeral: true });
  }

  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel || voiceChannel.id !== queue.voiceChannel.id) {
    return interaction.reply({ content: '❌ 你必須與機器人在同一個語音頻道中才能控制播放', ephemeral: true });
  }

  const customId = interaction.customId;

  try {
    if (customId === 'music_toggle') {
      if (queue.player.state.status === 'paused') {
        queue.player.unpause();
      } else {
        queue.player.pause();
      }
    } else if (customId === 'music_skip') {
      queue.player.stop();
      await interaction.reply({ content: '⏭️ 已跳過當前歌曲', ephemeral: true });
      return;
    } else if (customId === 'music_prev') {
      if (queue.history.length === 0) {
        return interaction.reply({ content: '❌ 沒有上一首歌曲的歷史記錄', ephemeral: true });
      }
      const prevSong = queue.history.pop();
      queue.songs.unshift(prevSong);
      queue.isGoingBack = true;
      queue.player.stop();
      await interaction.reply({ content: '⏮️ 正在播放上一首歌曲', ephemeral: true });
      return;
    } else if (customId === 'music_loop') {
      queue.loop = !queue.loop;
    } else if (customId === 'music_queue') {
      const { EmbedBuilder } = require('discord.js');
      const list = queue.songs.map((s, idx) => `${idx === 0 ? '▶️ 正在播放' : `${idx}.`} ${s.title}`).slice(0, 10).join('\n') || '無';
      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle('🎶 播放佇列')
        .setDescription(list);
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const card = music.createPlayerCard(queue);
    if (card) {
      await interaction.update(card).catch(() => {});
    }
  } catch (err) {
    logger.error('音樂按鈕控制失敗:', err.message);
    await interaction.reply({ content: '❌ 控制失敗：' + err.message, ephemeral: true }).catch(() => {});
  }
}
