---
name: configure
description: Set up the WeChat channel — scan QR code to login. Use when the user wants to connect WeChat, asks "how do I set this up", or needs to re-login.
user-invocable: true
allowed-tools:
  - Read
  - Write
  - Bash(bun *)
  - Bash(ls *)
  - Bash(mkdir *)
  - Bash(rm *)
  - Bash(cat *)
---

# /wechat:configure — WeChat Channel Setup

Runs QR code login for the WeChat channel. The user scans the QR code
with their WeChat app to authenticate.

Arguments passed: `$ARGUMENTS`

---

## Dispatch on arguments

### No args — status and login

1. **Check status** — read `~/.claude/channels/wechat/account.json`.
   - If exists: show botId (masked), userId, savedAt. Ask if they want to
     re-login.
   - If missing: proceed to login.

2. **Login** — run the login script interactively:
   ```
   bun /Users/jax/claude-channel-wechat/test-login.ts
   ```
   This will:
   - Fetch a QR code from Tencent's iLink API
   - Display it in the terminal (the user MUST be able to see it)
   - Wait for the user to scan with WeChat (up to 8 minutes)
   - Save credentials to `~/.claude/channels/wechat/account.json`

   The MCP server polls for account.json every 3 seconds and will
   automatically start the message loop once it appears.

3. **After success** — tell the user:
   *"WeChat connected! Send a message from WeChat to test."*

### `status` — check current state

Read and display `~/.claude/channels/wechat/account.json`. Show:
- Login state (configured / not configured)
- botId (first 12 chars + `...`)
- Last login time

### `logout` — remove credentials

1. Delete `~/.claude/channels/wechat/account.json`
2. Delete `~/.claude/channels/wechat/sync-buf.txt`
3. Confirm: *"Logged out. Run /wechat:configure to re-login."*

### `reset` — full reset

1. Delete entire `~/.claude/channels/wechat/` directory
2. Confirm: *"Reset complete. Run /wechat:configure to start fresh."*

---

## Implementation notes

- The login script (`test-login.ts`) MUST run with `bun` — it uses Bun APIs.
- The QR code will be displayed as ASCII art in the terminal. The user needs
  to scan it with their WeChat app within the timeout period.
- The MCP server is a separate subprocess managed by Claude Code. It
  automatically detects the account file — no restart needed after login.
- If the login script fails with a network error, suggest checking internet
  connectivity to `ilinkai.weixin.qq.com`.
