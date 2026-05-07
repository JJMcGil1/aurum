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

  // Bills
  getBills: () => ipcRenderer.invoke('db:getBills'),
  addBill: (bill: any) => ipcRenderer.invoke('db:addBill', bill),
  updateBill: (id: number, bill: any) => ipcRenderer.invoke('db:updateBill', id, bill),
  deleteBill: (id: number) => ipcRenderer.invoke('db:deleteBill', id),
  payBill: (id: number) => ipcRenderer.invoke('db:payBill', id),

  // Budgets
  getBudgets: () => ipcRenderer.invoke('db:getBudgets'),
  addBudget: (b: any) => ipcRenderer.invoke('db:addBudget', b),
  updateBudget: (id: number, b: any) => ipcRenderer.invoke('db:updateBudget', id, b),
  deleteBudget: (id: number) => ipcRenderer.invoke('db:deleteBudget', id),

  // Goals
  getGoals: () => ipcRenderer.invoke('db:getGoals'),
  addGoal: (g: any) => ipcRenderer.invoke('db:addGoal', g),
  updateGoal: (id: number, g: any) => ipcRenderer.invoke('db:updateGoal', id, g),
  deleteGoal: (id: number) => ipcRenderer.invoke('db:deleteGoal', id),
  contributeToGoal: (id: number, amount: number) => ipcRenderer.invoke('db:contributeToGoal', id, amount),

  // Net Worth
  getNetWorth: () => ipcRenderer.invoke('db:getNetWorth'),
  takeNetWorthSnapshot: () => ipcRenderer.invoke('db:takeNetWorthSnapshot'),

  // Savings
  getSavingsData: () => ipcRenderer.invoke('db:getSavingsData'),
  addSavingsContribution: (payload: any) => ipcRenderer.invoke('db:addSavingsContribution', payload),

  // Profile image
  pickProfileImage: () => ipcRenderer.invoke('dialog:pickProfileImage'),
}

const claude = {
  getStatus: () => ipcRenderer.invoke('claude:getStatus'),
  startLogin: () => ipcRenderer.invoke('claude:startLogin'),
  cancelLogin: () => ipcRenderer.invoke('claude:cancelLogin'),
  signOut: () => ipcRenderer.invoke('claude:signOut'),
  sendMessage: (prompt: string, options?: { sessionId?: string | null; model?: string | null }) =>
    ipcRenderer.invoke('claude:sendMessage', prompt, options ?? {}),
  onLoginEvent: (cb: (data: any) => void) => {
    const listener = (_e: any, data: any) => cb(data)
    ipcRenderer.on('claude:login-event', listener)
    return () => { ipcRenderer.removeListener('claude:login-event', listener) }
  },
}

contextBridge.exposeInMainWorld('api', api)
contextBridge.exposeInMainWorld('updater', updater)
contextBridge.exposeInMainWorld('claude', claude)
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
})
