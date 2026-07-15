const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const settings = require('../../services/settings');

module.exports = {
  category: '管理',
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('自動審核設定')
    .addSubcommand(sub =>
      sub.setName('toggle')
        .setDescription('啟用/停用自動審核'))
    .addSubcommand(sub =>
      sub.setName('word')
        .setDescription('管理過濾詞')
        .addStringOption(opt => opt.setName('動作').setDescription('add/remove/list').setRequired(true)
          .addChoices(
            { name: '新增', value: 'add' },
            { name: '刪除', value: 'remove' },
            { name: '列表', value: 'list' },
          ))
        .addStringOption(opt => opt.setName('詞').setDescription('要新增或刪除的詞（list 不需填）').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('links')
        .setDescription('啟用/停用連結過濾'))
    .addSubcommand(sub =>
      sub.setName('punishment')
        .setDescription('設定違規懲罰方式')
        .addStringOption(opt => opt.setName('方式').setDescription('懲罰方式').setRequired(true)
          .addChoices(
            { name: '刪除訊息', value: 'delete' },
            { name: '刪除+禁言', value: 'timeout' },
            { name: '刪除+踢出', value: 'kick' },
          ))
        .addIntegerOption(opt => opt.setName('分鐘').setDescription('禁言分鐘數（僅 timeout 有效）').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('strike')
        .setDescription('設定累犯門檻（第幾次用什麼罰）')
        .addIntegerOption(opt => opt.setName('次數').setDescription('第幾次違規').setRequired(true).setMinValue(2).setMaxValue(10))
        .addStringOption(opt => opt.setName('懲罰').setDescription('對應懲罰').setRequired(true)
          .addChoices(
            { name: '禁言', value: 'timeout' },
            { name: '踢出', value: 'kick' },
          )))
    .addSubcommand(sub =>
      sub.setName('strikereset')
        .setDescription('設定累犯重置時間（小時）')
        .addIntegerOption(opt => opt.setName('小時').setDescription('幾小時後重新計算 (預設24)').setRequired(true).setMinValue(1)))
    .addSubcommand(sub =>
      sub.setName('resetuser')
        .setDescription('重設某使用者的累犯次數')
        .addUserOption(opt => opt.setName('使用者').setDescription('要重設的使用者').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('log')
        .setDescription('設定公告級別')
        .addStringOption(opt => opt.setName('級別').setDescription('公告級別').setRequired(true)
          .addChoices(
            { name: '全部紀錄', value: 'all' },
            { name: '僅懲罰紀錄', value: 'punish_only' },
            { name: '不紀錄', value: 'off' },
          )))
    .addSubcommand(sub =>
      sub.setName('logchannel')
        .setDescription('設定紀錄頻道')
        .addChannelOption(opt => opt.setName('頻道').setDescription('要發送審核紀錄的頻道').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('phishing')
        .setDescription('啟用/停用釣魚連結偵測'))
    .addSubcommand(sub =>
      sub.setName('regex')
        .setDescription('管理正則過濾')
        .addStringOption(opt => opt.setName('動作').setDescription('add/remove/list').setRequired(true)
          .addChoices(
            { name: '新增', value: 'add' },
            { name: '刪除', value: 'remove' },
            { name: '列表', value: 'list' },
          ))
        .addStringOption(opt => opt.setName('正則').setDescription('要新增或刪除的正則表達式（list 不需填）').setRequired(false)))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const gs = settings.getGuildSettings(interaction.guild.id);
    if (!gs.autoMod) gs.autoMod = { enabled: false, words: [], regexWords: [], blockLinks: false, phishingProtection: false, logChannelId: '', punishment: 'delete', timeoutMinutes: 10, logLevel: 'all', strikes: { 2: 'timeout', 3: 'kick' }, strikeResetHours: 24, userStrikes: {} };

    if (sub === 'toggle') {
      gs.autoMod.enabled = !gs.autoMod.enabled;
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 自動審核已${gs.autoMod.enabled ? '啟用' : '停用'}`, ephemeral: true });
    }

    if (sub === 'word') {
      const action = interaction.options.getString('動作');
      const word = interaction.options.getString('詞');
      if (action === 'list') {
        const list = gs.autoMod.words.join(', ') || '（無）';
        return interaction.reply({ content: `📋 過濾詞列表：${list}`, ephemeral: true });
      }
      if (!word) return interaction.reply({ content: '請輸入詞彙', ephemeral: true });
      if (action === 'add') {
        gs.autoMod.words.push(word);
        settings.updateGuildSettings(interaction.guild.id, gs);
        return interaction.reply({ content: `✅ 已新增過濾詞：${word}`, ephemeral: true });
      }
      if (action === 'remove') {
        gs.autoMod.words = gs.autoMod.words.filter(w => w !== word);
        settings.updateGuildSettings(interaction.guild.id, gs);
        return interaction.reply({ content: `✅ 已刪除過濾詞：${word}`, ephemeral: true });
      }
    }

    if (sub === 'links') {
      gs.autoMod.blockLinks = !gs.autoMod.blockLinks;
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 連結過濾已${gs.autoMod.blockLinks ? '啟用' : '停用'}`, ephemeral: true });
    }

    if (sub === 'punishment') {
      gs.autoMod.punishment = interaction.options.getString('方式');
      const minutes = interaction.options.getInteger('分鐘');
      if (minutes) gs.autoMod.timeoutMinutes = minutes;
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 懲罰方式已設為：${gs.autoMod.punishment === 'delete' ? '刪除訊息' : gs.autoMod.punishment === 'timeout' ? `刪除+禁言 ${gs.autoMod.timeoutMinutes} 分鐘` : '刪除+踢出'}`, ephemeral: true });
    }

    if (sub === 'strike') {
      const count = interaction.options.getInteger('次數');
      const action = interaction.options.getString('懲罰');
      if (!gs.autoMod.strikes) gs.autoMod.strikes = {};
      gs.autoMod.strikes[String(count)] = action;
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 已設定第 ${count} 次違規 → ${action === 'timeout' ? '禁言' : '踢出'}`, ephemeral: true });
    }

    if (sub === 'strikereset') {
      gs.autoMod.strikeResetHours = interaction.options.getInteger('小時');
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 累犯重置時間已設為 ${gs.autoMod.strikeResetHours} 小時`, ephemeral: true });
    }

    if (sub === 'resetuser') {
      const target = interaction.options.getUser('使用者');
      if (gs.autoMod.userStrikes?.[target.id]) {
        delete gs.autoMod.userStrikes[target.id];
        settings.updateGuildSettings(interaction.guild.id, gs);
        return interaction.reply({ content: `✅ 已重設 ${target.username} 的累犯次數`, ephemeral: true });
      }
      return interaction.reply({ content: `❌ ${target.username} 沒有累犯紀錄`, ephemeral: true });
    }

    if (sub === 'log') {
      gs.autoMod.logLevel = interaction.options.getString('級別');
      settings.updateGuildSettings(interaction.guild.id, gs);
      const labels = { all: '全部紀錄', punish_only: '僅懲罰紀錄', off: '不紀錄' };
      return interaction.reply({ content: `✅ 公告級別已設為：${labels[gs.autoMod.logLevel]}`, ephemeral: true });
    }

    if (sub === 'logchannel') {
      const channel = interaction.options.getChannel('頻道');
      gs.autoMod.logChannelId = channel.id;
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 紀錄頻道已設為 ${channel}`, ephemeral: true });
    }

    if (sub === 'phishing') {
      gs.autoMod.phishingProtection = !gs.autoMod.phishingProtection;
      settings.updateGuildSettings(interaction.guild.id, gs);
      return interaction.reply({ content: `✅ 釣魚連結偵測已${gs.autoMod.phishingProtection ? '啟用' : '停用'}`, ephemeral: true });
    }

    if (sub === 'regex') {
      const action = interaction.options.getString('動作');
      const regex = interaction.options.getString('正則');
      if (action === 'list') {
        const list = gs.autoMod.regexWords.join(', ') || '（無）';
        return interaction.reply({ content: `📋 正則列表：${list}`, ephemeral: true });
      }
      if (!regex) return interaction.reply({ content: '請輸入正則表達式', ephemeral: true });
      try { new RegExp(regex); } catch { return interaction.reply({ content: '❌ 無效的正則表達式', ephemeral: true }); }
      if (action === 'add') {
        gs.autoMod.regexWords.push(regex);
        settings.updateGuildSettings(interaction.guild.id, gs);
        return interaction.reply({ content: `✅ 已新增正則：${regex}`, ephemeral: true });
      }
      if (action === 'remove') {
        gs.autoMod.regexWords = gs.autoMod.regexWords.filter(r => r !== regex);
        settings.updateGuildSettings(interaction.guild.id, gs);
        return interaction.reply({ content: `✅ 已刪除正則：${regex}`, ephemeral: true });
      }
    }
  },
};
