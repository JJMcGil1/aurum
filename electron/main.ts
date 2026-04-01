import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { Database } from './database'

app.disableHardwareAcceleration()

protocol.registerSchemesAsPrivileged([
  { scheme: 'local-file', privileges: { bypassCSP: true, stream: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null
let db: Database

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0f0f0f',
    icon: path.join(__dirname, '../build/icon.png'),
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

  // Set dock icon on macOS (needed during dev — production uses .icns from the bundle)
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setIcon(path.join(__dirname, '../build/icon.png'))
  }

  db = new Database()
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

function registerIpcHandlers() {
  // Family members
  ipcMain.handle('db:getFamilyMembers', () => db.getFamilyMembers())
  ipcMain.handle('db:addFamilyMember', (_, member) => db.addFamilyMember(member))
  ipcMain.handle('db:updateFamilyMember', (_, id, member) => db.updateFamilyMember(id, member))
  ipcMain.handle('db:deleteFamilyMember', (_, id) => db.deleteFamilyMember(id))

  // Accounts
  ipcMain.handle('db:getAccounts', () => db.getAccounts())
  ipcMain.handle('db:addAccount', (_, account) => db.addAccount(account))
  ipcMain.handle('db:updateAccount', (_, id, account) => db.updateAccount(id, account))
  ipcMain.handle('db:deleteAccount', (_, id) => db.deleteAccount(id))

  // Transactions
  ipcMain.handle('db:getTransactions', (_, filters) => db.getTransactions(filters))
  ipcMain.handle('db:addTransaction', (_, tx) => db.addTransaction(tx))
  ipcMain.handle('db:updateTransaction', (_, id, tx) => db.updateTransaction(id, tx))
  ipcMain.handle('db:deleteTransaction', (_, id) => db.deleteTransaction(id))

  // Categories
  ipcMain.handle('db:getCategories', () => db.getCategories())
  ipcMain.handle('db:addCategory', (_, cat) => db.addCategory(cat))
  ipcMain.handle('db:deleteCategory', (_, id) => db.deleteCategory(id))

  // Expenses
  ipcMain.handle('db:getExpenses', () => db.getExpenses())
  ipcMain.handle('db:addExpense', (_, expense) => db.addExpense(expense))
  ipcMain.handle('db:updateExpense', (_, id, expense) => db.updateExpense(id, expense))
  ipcMain.handle('db:deleteExpense', (_, id) => db.deleteExpense(id))
  ipcMain.handle('db:getNonPetMembers', () => db.getNonPetMembers())

  // Dashboard
  ipcMain.handle('db:getDashboardData', () => db.getDashboardData())

  // Profile image picker
  ipcMain.handle('dialog:pickProfileImage', async () => {
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
