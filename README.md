# claude-channel-wechat

用微信控制 Claude Code。扫码即用，不需要 OpenClaw。

```
微信 → 腾讯 iLink API → MCP Server (long-poll) → Claude Code
                      ← sendMessage              ← reply tool
```

底层直接调用腾讯的 iLink Bot API（`ilinkai.weixin.qq.com`），689 行代码，一个文件。

## 前提

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) v2.1.80+（需要 claude.ai 登录，不支持 API key）
- [Bun](https://bun.sh) 运行时
- 微信（iOS / Android / Mac / Windows 均可扫码）

## 安装

**1. 注册 marketplace**

在 `~/.claude/settings.json` 的 `extraKnownMarketplaces` 中加入：

```jsonc
{
  "extraKnownMarketplaces": {
    "claude-channel-wechat": {
      "source": {
        "source": "github",
        "repo": "JrCx7scC/claude-channel-wechat"
      }
    }
  }
}
```

**2. 安装插件**

在 Claude Code 中执行：

```
/plugin install wechat@claude-channel-wechat
```

**3. 启动**

```bash
claude --dangerously-load-development-channels plugin:wechat@claude-channel-wechat
```

**4. 扫码连接**

在 Claude Code 中输入 `/wechat:configure`，终端弹出二维码，微信扫一下就连上了。

## 使用

### 发消息

登录后，在微信里给 ClawBot 发消息，Claude Code 会实时收到并处理。Claude 通过 `reply` 工具回复，消息会出现在你的微信对话里。

```
你（微信）: 帮我看看 main.py 有没有 bug
Claude Code: [读取文件、分析代码、通过 reply 工具回复]
你（微信）: 收到 Claude 的分析结果
```

### 重新登录

Session 过期后需要重新扫码：

```bash
# 删除旧凭证
rm ~/.claude/channels/wechat/account.json

# 在 Claude Code 中重新扫码
/wechat:configure
```

## 工作原理

逆向了腾讯的 `@tencent-weixin/openclaw-weixin` 插件，发现底层是 6 个 HTTP API：

| API | 功能 |
|-----|------|
| `ilink/bot/get_bot_qrcode` | 获取登录二维码 |
| `ilink/bot/get_qrcode_status` | 轮询扫码状态 |
| `ilink/bot/getupdates` | 长轮询收消息（35s 超时） |
| `ilink/bot/sendmessage` | 发送消息 |
| `ilink/bot/sendtyping` | 打字状态指示 |
| `ilink/bot/getconfig` | 获取 typing ticket |

整个 OpenClaw 只是在这 6 个 API 上套了一层路由壳子。我们直接调用 iLink API，用 MCP 协议桥接到 Claude Code。

### 认证模型

跟 Telegram Channel 完全不同：

| | Telegram | WeChat |
|---|---|---|
| 认证 | BotFather token + 6字符配对码 | **微信扫码即认证** |
| Access 控制 | pairing/allowlist/open | 不需要 |
| 原因 | Bot 是公开的，谁都能发消息 | 扫码本身就是身份验证 |

所以 WeChat 版比 Telegram 版少了近 100 行代码（689 vs 780），因为整个 access control 层不需要了。

## 状态文件

```
~/.claude/channels/wechat/
├── account.json     # 登录凭证（bot token, base URL, bot ID）
└── sync-buf.txt     # 消息同步游标（断点续传）
```

## 限制

- **权限审批仍需在电脑上**：Claude Code 改文件、跑命令需要在终端点同意，Channel 解决不了这个问题
- **仅文本消息**：当前不支持图片/文件发送
- **无消息历史**：iLink API 没有搜索和历史功能，只能看实时消息
- **Session 会过期**：需要重新扫码（errcode -14）
- **需要先收到消息**：`context_token` 是按消息发放的，用户必须先发消息 Claude 才能回复

## 它是什么 / 不是什么

**是**：远程终端的通知系统。你能在微信里看到 Claude 在干什么、卡在哪里。

**不是**：聊天机器人。它不是微信版 ChatGPT，它是你电脑上 Claude Code 的远程窗口。

## License

MIT
