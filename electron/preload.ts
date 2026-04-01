import { contextBridge, ipcRenderer } from 'electron'

const updater = {
  checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
  downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
  installUpdate: () => ipcRenderer.invoke('updater:installUpdate'),
  dismissUpdate: () => ipcRenderer.invoke('updater:dismissUpdate'),
  onUpdateAvailable: (cb: (data: any) => void) => {
    ipcRenderer.on('updater:update-available', (_e, data) => cb(data))
    return () => { ipcRenderer.removeAllListeners('updater:update-available') }
  },
  onDownloadProgress: (cb: (data: any) => void) => {
    ipcRenderer.on('updater:download-progress', (_e, data) => cb(data))
    return () => { ipcRenderer.removeAllListeners('updater:download-progress') }
  },
  onUpdateDownloaded: (cb: () => void) => {
    ipcRenderer.on('updater:update-downloaded', () => cb())
    return () => { ipcRenderer.removeAllListeners('updater:update-downloaded') }
  },
  onUpdateError: (cb: (data: any) => void) => {
    ipcRenderer.on('updater:update-error', (_e, data) => cb(data))
    return () => { ipcRenderer.removeAllListeners('updater:update-error') }
  },
}

const api = {
  // Family Members
  getFamilyMembers: () => ipcRenderer.invoke('db:getFamilyMembers'),
  addFamilyMember: (member: any) => ipcRenderer.invoke('db:addFamilyMember', member),
  updateFamilyMember: (id: number, member: any) => ipcRenderer.invoke('db:updateFamilyMember', id, member),
  deleteFamilyMember: (id: number) => ipcRenderer.invoke('db:deleteFamilyMember', id),

  // Accounts
  getAccounts: () => ipcRenderer.invoke('db:getAccounts'),
  addAccount: (account: any) => ipcRenderer.invoke('db:addAccount', account),
  updateAccount: (id: number, account: any) => ipcRenderer.invoke('db:updateAccount', id, account),
  deleteAccount: (id: number) => ipcRenderer.invoke('db:deleteAccount', id),

  // Transactions
  getTransactions: (filters?: any) => ipcRenderer.invoke('db:getTransactions', filters),
  addTransaction: (tx: any) => ipcRenderer.invoke('db:addTransaction', tx),
  updateTransaction: (id: number, tx: any) => ipcRenderer.invoke('db:updateTransaction', id, tx),
  deleteTransaction: (id: number) => ipcRenderer.invoke('db:deleteTransaction', id),

  // Categories
  getCategories: () => ipcRenderer.invoke('db:getCategories'),
  addCategory: (cat: any) => ipcRenderer.invoke('db:addCategory', cat),
  deleteCategory: (id: number) => ipcRenderer.invoke('db:deleteCategory', id),

  // Expenses
  getExpenses: () => ipcRenderer.invoke('db:getExpenses'),
  addExpense: (expense: any) => ipcRenderer.invoke('db:addExpense', expense),
  updateExpense: (id: number, expense: any) => ipcRenderer.invoke('db:updateExpense', id, expense),
  deleteExpense: (id: number) => ipcRenderer.invoke('db:deleteExpense', id),
  getNonPetMembers: () => ipcRenderer.invoke('db:getNonPetMembers'),

  // Dashboard
  getDashboardData: () => ipcRenderer.invoke('db:getDashboardData'),

  // Profile image
  pickProfileImage: () => ipcRenderer.invoke('dialog:pickProfileImage'),
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('updater', updater)
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
})
