# claude-channel-wechat

微信 Channel for Claude Code — 通过腾讯 iLink Bot API 将微信消息桥接到 Claude Code 会话。

## 架构

```
微信用户 → 腾讯 iLink API → 本地 MCP Server (long-poll) → Claude Code Session
                          ← sendMessage                  ← reply tool
```

**无需 OpenClaw。** 直接使用腾讯的 iLink Bot API (`ilinkai.weixin.qq.com`)。

## 安装

```bash
# 1. 确保已安装 Bun
curl -fsSL https://bun.sh/install | bash

# 2. 克隆/下载本项目
cd claude-channel-wechat
bun install

# 3. 添加到 Claude Code MCP 配置
# 在 ~/.claude.json 或项目 .mcp.json 中添加：
```

```json
{
  "mcpServers": {
    "wechat": {
      "command": "bun",
      "args": ["/path/to/claude-channel-wechat/server.ts"]
    }
  }
}
```

## 使用

```bash
# 启动（首次会显示二维码，用微信扫描登录）
claude --dangerously-load-development-channels server:wechat
```

1. 终端显示二维码 → 用微信扫描
2. 扫码登录的微信账号自动加入白名单
3. 其他人给你发消息 → 收到配对码 → 在终端执行 `/wechat:access pair <code>` 批准
4. 批准后的用户消息会转发到 Claude Code 会话

## 访问控制

```bash
# 在 Claude Code 中执行
/wechat:access pair <code>        # 批准配对
/wechat:access list               # 查看白名单
/wechat:access add <userId>       # 手动添加
/wechat:access remove <userId>    # 移除
/wechat:access policy allowlist   # 锁定（不再接受新配对）
```

## 状态文件

```
~/.claude/channels/wechat/
├── account.json     # 登录凭证（bot token, base URL）
├── access.json      # 访问控制（白名单、待配对）
├── sync-buf.txt     # 消息同步游标
└── approved/        # 配对批准信号文件
```

## 工作原理

- **登录**: 调用 `ilink/bot/get_bot_qrcode` 获取二维码，用户扫码后获得 `bot_token`
- **收消息**: 长轮询 `ilink/bot/getupdates`，35秒超时
- **发消息**: POST `ilink/bot/sendmessage`，需要 `context_token`（从收到的消息中提取）
- **打字状态**: `ilink/bot/sendtyping`，需要 `typing_ticket`（从 `getconfig` 获取）
- **Session 过期**: errcode -14 时需要重新扫码登录

## 限制

- 不支持图片/文件发送（当前仅文本）
- 微信 Bot API 没有消息历史/搜索
- Session 可能过期，需要重新扫码
- `context_token` 是按消息发放的，用户必须先发消息才能收到回复

## License

MIT
