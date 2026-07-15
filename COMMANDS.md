# OmniBot 指令大全

## 🛡️ 管理

| 指令 | 說明 | 權限 |
|---|---|---|
| `/ban @成員 原因` | 封鎖成員（私訊告知+申訴連結） | BanMembers |
| `/kick @成員 原因` | 踢出成員（私訊告知+申訴連結） | KickMembers |
| `/timeout @成員 分鐘 原因` | 禁言成員 | ModerateMembers |
| `/clear 數量` | 清除訊息 | ManageMessages |
| `/warn @成員 原因` | 警告成員 | 可惡管管們↑ |
| `/forceunmute @成員` | 強制解除禁言 | 可愛管管們 |
| `/botctl ping` | 機器人狀態 | 可愛管管們 |
| `/botctl reload` | 重新載入指令 | 可愛管管們 |

## 👑 權限管理

| 指令 | 說明 | 權限 |
|---|---|---|
| `/admin role 層級 身分組 動作` | 設定管理員身分組 | Administrator |
| `/admin block @使用者` | 封鎖登入後臺 | Administrator |
| `/admin unblock @使用者` | 解封 | Administrator |
| `/admin list` | 查看管理員設定 | Administrator |

## 🤖 自動審核

| 指令 | 說明 | 權限 |
|---|---|---|
| `/automod toggle` | 啟用/停用 | Administrator |
| `/automod word add/remove/list 詞` | 管理過濾詞 | Administrator |
| `/automod links` | 啟用連結過濾 | Administrator |
| `/automod punishment 方式 分鐘` | 設定懲罰 | Administrator |
| `/automod strike 次數 懲罰` | 設定累犯門檻 | Administrator |
| `/automod strikereset 小時` | 重置時間 | Administrator |
| `/automod resetuser @成員` | 重設某人累犯 | Administrator |
| `/automod log 級別` | 公告級別 | Administrator |
| `/automod logchannel #頻道` | 設定紀錄頻道 | Administrator |
| `/automod phishing` | 啟用/停用釣魚連結偵測 | Administrator |
| `/automod regex add/remove/list 正則` | 管理正則過濾 | Administrator |
| `/tempban @成員 分鐘 原因` | 暫時封鎖（時間到自動解封） | BanMembers |
| `/lockdown #頻道` | 鎖定頻道 | ManageChannels |
| `/unlockdown #頻道` | 解鎖頻道 | ManageChannels |
| `/slowmode 秒數 #頻道` | 設定慢速模式 | ManageChannels |
| `/autorole set/remove/status @身分組` | 管理自動身分組 | Administrator |
| `/warns list/remove/clear @成員` | 查看/管理警告紀錄 | 可惡管管們 |
| `/massrole add/remove @身分組 ID列表` | 批次管理身分組 | ManageRoles |
| `/verify setup/remove #頻道 @身分組` | 按鈕驗證系統 | Administrator |
| `/modlog set/remove #頻道` | 管理操作日誌頻道 | Administrator |

## 🚨 防轟炸

| 指令 | 說明 | 權限 |
|---|---|---|
| `/antiraid toggle` | 啟用/停用 | Administrator |
| `/antiraid join 次數 秒數` | 大量加入設定 | Administrator |
| `/antiraid spam 次數 秒數 禁言` | 大量訊息設定 | Administrator |
| `/antiraid action kick/log` | 觸發動作 | Administrator |
| `/antiraid status` | 查看設定 | Administrator |

## 🔗 連結管理

| 指令 | 說明 | 權限 |
|---|---|---|
| `/inviteguard toggle` | 啟用過濾 | Administrator |
| `/inviteguard whitelist add/remove/list 碼` | 管理白名單 | Administrator |

## 🎭 身分組

| 指令 | 說明 | 權限 |
|---|---|---|
| `/role` | 自助領取選單 | 所有人 |
| `/rolepanel 標題 說明` | 發送永久領取面板 | Administrator |
| `/give @成員 @身分組` | 公開派發+自動公告 | Administrator |

## 🔊 語音包房

| 指令 | 說明 | 權限 |
|---|---|---|
| `/voice setup #頻道` | 設定創建頻道 | Administrator |
| `/voice rename 名稱` | 重新命名包房 | 包房主人 |
| `/voice lock / unlock` | 鎖定/解鎖 | 包房主人 |
| `/voice kick @成員` | 踢出成員 | 包房主人 |
| `/voice give @成員` | 轉讓所有權 | 包房主人 |
| `/voice limit 人數` | 人數上限 | 包房主人 |

## 🎫 工單

| 指令 | 說明 | 權限 |
|---|---|---|
| `/ticket setup` | 發送開單面板 | Administrator |
| `/ticket add @成員` | 加入工單 | Administrator |
| `/ticket remove @成員` | 移出工單 | Administrator |

## 💬 自訂指令

| 指令 | 說明 | 權限 |
|---|---|---|
| `/customcmd create 名稱 回覆` | 建立自訂指令 | 可愛管管們 |
| `/customcmd delete 名稱` | 刪除 | 可愛管管們 |
| `/customcmd list` | 列表 | 可愛管管們 |
| `/tag 名稱` | 使用自訂指令 | 所有人 |
| `@Bot 名稱` | 使用自訂指令 | 可愛管管們 |

## 🎁 抽獎

| 指令 | 說明 | 權限 |
|---|---|---|
| `/giveaway start 獎品 人數 時間` | 開抽獎 | Administrator |

## 📊 計數器

| 指令 | 說明 | 權限 |
|---|---|---|
| `/counter #頻道 members/online` | 語音頻道顯示成員/在線數 | Administrator |

## 📢 通知

| 指令 | 說明 | 權限 |
|---|---|---|
| `/notify 訊息 頻道 提及` | 發送推播通知 | Administrator |

## 🔍 其他

| 指令 | 說明 | 權限 |
|---|---|---|
| `/ping` | 機器人延遲 | 所有人 |
| `/help` | 幫助 | 所有人 |
| `/userinfo` | 使用者資訊 | 所有人 |
| `/serverinfo` | 伺服器資訊 | 所有人 |
| `/weather 城市` | 天氣查詢 | 所有人 |
| `/translate 文字 語言` | 翻譯 | 所有人 |
| `/earthquake` | 最近地震 | 所有人 |
| `/suspension` | 停班停課 | 所有人 |
| `/createpoll 問題 選項` | 建立投票 | 所有人 |
| `/patrick` | 派大星 | 所有人 |

## 🎵 音樂

| 指令 | 說明 | 權限 |
|---|---|---|
| `/play 關鍵字或網址` | 播放音樂 | 所有人 |
| `/music skip` | 跳過 | 所有人 |
| `/music stop` | 停止並離開 | 所有人 |
| `/music np` | 目前播放 | 所有人 |
| `/music queue` | 播放佇列 | 所有人 |
| `/music pause / resume` | 暫停/繼續 | 所有人 |
| `/music loop` | 循環播放 | 所有人 |
| `/music volume 0-100` | 調整音量 | 所有人 |
