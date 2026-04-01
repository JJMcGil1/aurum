import { app, BrowserWindow, ipcMain } from 'electron'
import { execSync } from 'child_process'
import https from 'https'
import http from 'http'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const REPO_OWNER = 'JJMcGil1'
const REPO_NAME = 'aurum'
const CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes
const STARTUP_DELAY = 5 * 1000 // 5 seconds
const DOWNLOAD_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const API_TIMEOUT = 30 * 1000 // 30 seconds
const DOWNLOAD_DIR = '/tmp/aurum-update'

interface UpdateInfo {
  version: string
  releaseDate: string
  releaseNotes: string
  downloadUrl: string
  sha256: string
  size: number
}

let currentUpdate: UpdateInfo | null = null
let checkTimer: ReturnType<typeof setInterval> | null = null
let mainWindow: BrowserWindow | null = null

function getArch(): string {
  return process.arch === 'arm64' ? 'arm64' : ''
}

function getDmgAssetName(version: string): string {
  const arch = getArch()
  return arch ? `Aurum-${version}-${arch}.dmg` : `Aurum-${version}.dmg`
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0
    const nb = pb[i] || 0
    if (na > nb) return 1
    if (na < nb) return -1
  }
  return 0
}

function sendToRenderer(channel: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function httpGet(url: string, timeout: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const req = protocol.get(url, { headers: { 'User-Agent': 'Aurum-Auto-Updater' } }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        httpGet(res.headers.location, timeout).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => resolve(data))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Request timeout')) })
  })
}

function downloadFile(url: string, dest: string, onProgress: (percent: number, transferred: number, total: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    const req = protocol.get(url, { headers: { 'User-Agent': 'Aurum-Auto-Updater' } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`))
        return
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      let transferred = 0
      const file = fs.createWriteStream(dest)
      res.on('data', (chunk: Buffer) => {
        transferred += chunk.length
        const percent = total > 0 ? Math.round((transferred / total) * 100) : 0
        onProgress(percent, transferred, total)
      })
      res.pipe(file)
      file.on('finish', () => { file.close(); resolve() })
      file.on('error', reject)
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setTimeout(DOWNLOAD_TIMEOUT, () => { req.destroy(); reject(new Error('Download timeout')) })
  })
}

async function checkForUpdates(): Promise<UpdateInfo | null> {
  try {
    const latestJsonUrl = `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/latest/download/latest.json`
    const data = await httpGet(latestJsonUrl, API_TIMEOUT)
    const release = JSON.parse(data)

    const currentVersion = app.getVersion()
    if (compareVersions(release.version, currentVersion) <= 0) {
      return null
    }

    const dmgName = getDmgAssetName(release.version)
    const arch = getArch()
    const platformKey = arch === 'arm64' ? 'mac-arm64' : 'mac'
    const platformInfo = release.platforms?.[platformKey] || release.platforms?.mac

    if (!platformInfo) {
      return null
    }

    currentUpdate = {
      version: release.version,
      releaseDate: release.releaseDate,
      releaseNotes: release.releaseNotes || 'Bug fixes and improvements.',
      downloadUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/v${release.version}/${dmgName}`,
      sha256: platformInfo.sha256,
      size: platformInfo.size,
    }

    return currentUpdate
  } catch (err) {
    console.error('[auto-updater] Check failed:', err)
    return null
  }
}

async function downloadUpdate(): Promise<boolean> {
  if (!currentUpdate) return false

  try {
    if (!fs.existsSync(DOWNLOAD_DIR)) {
      fs.mkdirSync(DOWNLOAD_DIR, { recursive: true })
    }

    const dmgPath = path.join(DOWNLOAD_DIR, `Aurum-${currentUpdate.version}.dmg`)

    await downloadFile(currentUpdate.downloadUrl, dmgPath, (percent, transferred, total) => {
      sendToRenderer('updater:download-progress', { percent, transferred, total })
    })

    // Verify SHA256
    const fileBuffer = fs.readFileSync(dmgPath)
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex')

    if (hash !== currentUpdate.sha256) {
      fs.unlinkSync(dmgPath)
      throw new Error(`SHA256 mismatch: expected ${currentUpdate.sha256}, got ${hash}`)
    }

    sendToRenderer('updater:update-downloaded')
    return true
  } catch (err) {
    console.error('[auto-updater] Download failed:', err)
    sendToRenderer('updater:update-error', { message: (err as Error).message })
    return false
  }
}

function installUpdate(): void {
  if (!currentUpdate) return

  try {
    const dmgPath = path.join(DOWNLOAD_DIR, `Aurum-${currentUpdate.version}.dmg`)
    if (!fs.existsSync(dmgPath)) {
      sendToRenderer('updater:update-error', { message: 'Downloaded file not found' })
      return
    }

    // Mount DMG
    const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse -noverify -noautoopen`, { encoding: 'utf-8' })
    const mountMatch = mountOutput.match(/\/Volumes\/.+/)
    if (!mountMatch) {
      throw new Error('Failed to mount DMG')
    }

    const mountPoint = mountMatch[0].trim()
    const appName = 'Aurum.app'
    const sourceApp = path.join(mountPoint, appName)
    const destApp = path.dirname(path.dirname(path.dirname(app.getPath('exe'))))

    // Copy new .app over existing
    execSync(`rm -rf "${destApp}"`)
    execSync(`cp -R "${sourceApp}" "${destApp}"`)

    // Strip quarantine attribute
    execSync(`xattr -cr "${destApp}"`)

    // Unmount DMG
    execSync(`hdiutil detach "${mountPoint}" -quiet`)

    // Clean up
    try {
      fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true })
    } catch {
      // Best effort cleanup
    }

    // Relaunch
    app.relaunch()
    app.exit(0)
  } catch (err) {
    console.error('[auto-updater] Install failed:', err)
    sendToRenderer('updater:update-error', { message: (err as Error).message })
  }
}

export function initAutoUpdater(win: BrowserWindow) {
  mainWindow = win

  // IPC handlers
  ipcMain.handle('updater:checkForUpdates', async () => {
    const update = await checkForUpdates()
    if (update) {
      sendToRenderer('updater:update-available', {
        version: update.version,
        releaseNotes: update.releaseNotes,
      })
    }
    return update
  })

  ipcMain.handle('updater:downloadUpdate', async () => {
    return await downloadUpdate()
  })

  ipcMain.handle('updater:installUpdate', () => {
    installUpdate()
  })

  ipcMain.handle('updater:dismissUpdate', () => {
    currentUpdate = null
  })

  // Start polling after startup delay
  setTimeout(() => {
    checkForUpdates().then((update) => {
      if (update) {
        sendToRenderer('updater:update-available', {
          version: update.version,
          releaseNotes: update.releaseNotes,
        })
      }
    })

    checkTimer = setInterval(async () => {
      const update = await checkForUpdates()
      if (update) {
        sendToRenderer('updater:update-available', {
          version: update.version,
          releaseNotes: update.releaseNotes,
        })
      }
    }, CHECK_INTERVAL)
  }, STARTUP_DELAY)
}

export function stopAutoUpdater() {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
}
