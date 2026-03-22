#!/usr/bin/env bun
/**
 * Test script: QR code login only, no MCP server.
 * Run: bun test-login.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { renameSync } from 'fs'

const STATE_DIR = process.env.WECHAT_STATE_DIR ?? join(homedir(), '.claude', 'channels', 'wechat')
const ACCOUNT_FILE = join(STATE_DIR, 'account.json')
const DEFAULT_BASE_URL = 'https://ilinkai.weixin.qq.com'
const DEFAULT_BOT_TYPE = '3'
const LONG_POLL_TIMEOUT_MS = 35_000

type QRCodeResponse = { qrcode: string; qrcode_img_content: string }
type StatusResponse = {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired'
  bot_token?: string
  ilink_bot_id?: string
  baseurl?: string
  ilink_user_id?: string
}

type AccountData = {
  token: string
  baseUrl: string
  botId: string
  userId?: string
  savedAt: string
}

async function fetchQRCode(apiBaseUrl: string): Promise<QRCodeResponse> {
  const base = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`
  const url = `${base}ilink/bot/get_bot_qrcode?bot_type=${DEFAULT_BOT_TYPE}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch QR code: ${res.status}`)
  return await res.json() as QRCodeResponse
}

async function pollQRStatus(apiBaseUrl: string, qrcode: string): Promise<StatusResponse> {
  const base = apiBaseUrl.endsWith('/') ? apiBaseUrl : `${apiBaseUrl}/`
  const url = `${base}ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LONG_POLL_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      headers: { 'iLink-App-ClientVersion': '1' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`QR status poll failed: ${res.status}`)
    return await res.json() as StatusResponse
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') return { status: 'wait' }
    throw err
  }
}

// ── Main ──────────────────────────────────────────────────────────────────

console.log('获取二维码中...\n')

const qr = await fetchQRCode(DEFAULT_BASE_URL)

console.log('使用微信扫描以下二维码：\n')
try {
  const qrterm = await import('qrcode-terminal')
  await new Promise<void>(resolve => {
    qrterm.default.generate(qr.qrcode_img_content, { small: true }, (output: string) => {
      console.log(output)
      resolve()
    })
  })
} catch {
  console.log(`二维码链接: ${qr.qrcode_img_content}`)
}

console.log('\n等待扫码...\n')

const deadline = Date.now() + 480_000
let scannedPrinted = false

while (Date.now() < deadline) {
  const status = await pollQRStatus(DEFAULT_BASE_URL, qr.qrcode)

  switch (status.status) {
    case 'wait':
      process.stdout.write('.')
      break
    case 'scaned':
      if (!scannedPrinted) {
        console.log('\n👀 已扫码，在微信中确认...')
        scannedPrinted = true
      }
      break
    case 'expired':
      console.log('\n❌ 二维码已过期')
      process.exit(1)
    case 'confirmed': {
      if (!status.ilink_bot_id || !status.bot_token) {
        console.log('\n❌ 登录失败：服务器未返回 bot token')
        process.exit(1)
      }
      const account: AccountData = {
        token: status.bot_token,
        baseUrl: status.baseurl ?? DEFAULT_BASE_URL,
        botId: status.ilink_bot_id,
        userId: status.ilink_user_id,
        savedAt: new Date().toISOString(),
      }
      mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 })
      const tmp = ACCOUNT_FILE + '.tmp'
      writeFileSync(tmp, JSON.stringify(account, null, 2), { mode: 0o600 })
      renameSync(tmp, ACCOUNT_FILE)

      console.log(`\n✅ 登录成功！`)
      console.log(`   botId:  ${account.botId}`)
      console.log(`   userId: ${account.userId ?? 'unknown'}`)
      console.log(`   baseUrl: ${account.baseUrl}`)
      console.log(`   saved to: ${ACCOUNT_FILE}`)
      process.exit(0)
    }
  }

  await new Promise(r => setTimeout(r, 1000))
}

console.log('\n❌ 登录超时')
process.exit(1)
