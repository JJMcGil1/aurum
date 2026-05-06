import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { Database } from './database'
import { initAutoUpdater, stopAutoUpdater } from './auto-updater'

app.disableHardwareAcceleration()

process.on('uncaughtException', (err) => logToFile('uncaughtException', err))
process.on('unhandledRejection', (err) => logToFile('unhandledRejection', err))

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null
let db: Database | null = null
let dbInitError: string | null = null

function logToFile(label: string, payload: unknown) {
  try {
    const logsDir = app.getPath('logs')
    fs.mkdirSync(logsDir, { recursive: true })
    const line = `[${new Date().toISOString()}] ${label}: ${typeof payload === 'string' ? payload : JSON.stringify(payload, Object.getOwnPropertyNames(payload as object))}\n`
    fs.appendFileSync(path.join(logsDir, 'aurum-main.log'), line)
    console.error(line)
  } catch (e) {
    console.error('logToFile failed', e, 'original:', label, payload)
  }
}

function dbHandler<T extends (...args: any[]) => any>(name: string, fn: T) {
  ipcMain.handle(name, (...args: any[]) => {
    if (!db) {
      const msg = `Database unavailable: ${dbInitError ?? 'unknown error'}`
      logToFile(`ipc:${name}`, msg)
      throw new Error(msg)
    }
    try {
      return (fn as any)(...args)
    } catch (err: any) {
      logToFile(`ipc:${name}`, err)
      throw err
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    icon: process.env.VITE_DEV_SERVER_URL ? path.join(__dirname, '../build/icon.png') : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  // Register protocol for serving local profile images
  protocol.handle('local-file', (request) => {
    const filePath = decodeURIComponent(request.url.replace('local-file://', ''))
    return net.fetch('file://' + filePath)
  })

  // Set dock icon on macOS — only needed during dev; production uses .icns from the bundle
  if (process.platform === 'darwin' && app.dock && process.env.VITE_DEV_SERVER_URL) {
    const iconPath = path.join(__dirname, '../build/icon.png')
    if (fs.existsSync(iconPath)) {
      app.dock.setIcon(iconPath)
    }
  }

  // Database init must not block window creation or auto-updater
  try {
    db = new Database()
  } catch (err: any) {
    dbInitError = err?.stack || err?.message || String(err)
    logToFile('db:init', err)
    dialog.showErrorBox('Database Error', `Aurum could not initialize the database:\n\n${dbInitError}\n\nLogs: ${path.join(app.getPath('logs'), 'aurum-main.log')}`)
  }

  // Always register handlers — even on DB failure — so the renderer gets a typed
  // error instead of "No handler registered for ...".
  registerIpcHandlers()
  ipcMain.handle('db:getError', () => dbInitError)

  createWindow()

  if (mainWindow) {
    initAutoUpdater(mainWindow)
  }
})

app.on('window-all-closed', () => {
  stopAutoUpdater()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

function registerIpcHandlers() {
  // App version
  ipcMain.handle('app:getVersion', () => app.getVersion())

  // Family members
  dbHandler('db:getFamilyMembers', () => db!.getFamilyMembers())
  dbHandler('db:addFamilyMember', (_: any, member: any) => db!.addFamilyMember(member))
  dbHandler('db:updateFamilyMember', (_: any, id: number, member: any) => db!.updateFamilyMember(id, member))
  dbHandler('db:deleteFamilyMember', (_: any, id: number) => db!.deleteFamilyMember(id))

  // Accounts
  dbHandler('db:getAccounts', () => db!.getAccounts())
  dbHandler('db:addAccount', (_: any, account: any) => db!.addAccount(account))
  dbHandler('db:updateAccount', (_: any, id: number, account: any) => db!.updateAccount(id, account))
  dbHandler('db:deleteAccount', (_: any, id: number) => db!.deleteAccount(id))

  // Transactions
  dbHandler('db:getTransactions', (_: any, filters: any) => db!.getTransactions(filters))
  dbHandler('db:addTransaction', (_: any, tx: any) => db!.addTransaction(tx))
  dbHandler('db:updateTransaction', (_: any, id: number, tx: any) => db!.updateTransaction(id, tx))
  dbHandler('db:deleteTransaction', (_: any, id: number) => db!.deleteTransaction(id))

  // Categories
  dbHandler('db:getCategories', () => db!.getCategories())
  dbHandler('db:addCategory', (_: any, cat: any) => db!.addCategory(cat))
  dbHandler('db:deleteCategory', (_: any, id: number) => db!.deleteCategory(id))

  // Expenses
  dbHandler('db:getExpenses', () => db!.getExpenses())
  dbHandler('db:addExpense', (_: any, expense: any) => db!.addExpense(expense))
  dbHandler('db:updateExpense', (_: any, id: number, expense: any) => db!.updateExpense(id, expense))
  dbHandler('db:deleteExpense', (_: any, id: number) => db!.deleteExpense(id))
  dbHandler('db:getNonPetMembers', () => db!.getNonPetMembers())

  // Dashboard
  dbHandler('db:getDashboardData', () => db!.getDashboardData())

  // Profile image picker
  ipcMain.handle('dialog:pickProfileImage', async () => {
    if (!db) throw new Error(`Database unavailable: ${dbInitError ?? 'unknown error'}`)
    const result = await dialog.showOpenDialog({
      title: 'Choose Profile Image',
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const src = result.filePaths[0]
    const ext = path.extname(src)
    const filename = crypto.randomUUID() + ext
    const dest = path.join(db.profileImagesDir, filename)
    fs.copyFileSync(src, dest)
    return dest
  })
}
