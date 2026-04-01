import { contextBridge, ipcRenderer } from 'electron'

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
