export interface FamilyMember {
  id: number
  first_name: string
  last_name: string
  name: string // computed: first_name + last_name
  role: string
  avatar_color: string
  avatar_image: string | null
  created_at: string
}

export interface Account {
  id: number
  name: string
  type: 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash' | 'loan'
  balance: number
  currency: string
  institution: string | null
  owner_id: number | null
  owner_name: string | null
  created_at: string
}

export interface Category {
  id: number
  name: string
  type: 'income' | 'expense'
  icon: string | null
  color: string
}

export interface Transaction {
  id: number
  amount: number
  type: 'income' | 'expense' | 'transfer'
  description: string
  date: string
  account_id: number
  account_name: string
  category_id: number | null
  category_name: string | null
  category_color: string | null
  family_member_id: number | null
  family_member_name: string | null
  notes: string | null
  created_at: string
}

export interface ExpenseMember {
  id: number
  expense_id: number
  member_id: number
  role: 'beneficiary' | 'payer'
  amount: number | null
  member_name: string
  avatar_color: string
  avatar_image: string | null
  member_role: string
}

export interface Expense {
  id: number
  name: string
  amount: number
  notes: string | null
  created_at: string
  beneficiaries: ExpenseMember[]
  payers: ExpenseMember[]
}

export interface DashboardData {
  totalExpenses: number
  monthlyExpenses: number
  expenseCount: number
  averageExpense: number
  recentExpenses: { id: number; name: string; amount: number; created_at: string; payers: string }[]
  monthlyTrend: { month: string; expenses: number }[]
  spendingByMember: { name: string; avatar_color: string; total: number }[]
}

export type BillRecurrence = 'once' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface Bill {
  id: number
  name: string
  amount: number
  due_date: string
  recurrence: BillRecurrence
  category_id: number | null
  category_name: string | null
  category_color: string | null
  account_id: number | null
  account_name: string | null
  notes: string | null
  is_paid: number
  last_paid_date: string | null
  created_at: string
}

export type BudgetPeriod = 'weekly' | 'monthly' | 'yearly'

export interface Budget {
  id: number
  category_id: number
  category_name: string
  category_color: string
  amount: number
  period: BudgetPeriod
  spent: number
  period_start: string
  period_end: string
  created_at: string
}

export interface Goal {
  id: number
  name: string
  target_amount: number
  current_amount: number
  target_date: string | null
  color: string
  notes: string | null
  created_at: string
}

export interface NetWorthSnapshot {
  date: string
  assets: number
  liabilities: number
  net_worth: number
}

export interface NetWorthData {
  assets: number
  liabilities: number
  netWorth: number
  history: NetWorthSnapshot[]
  breakdown: { type: string; total: number; count: number }[]
}

export interface SavingsData {
  totalSavings: number
  savingsRate: number
  monthIncome: number
  monthExpense: number
  monthSaved: number
  trend: { month: string; saved: number }[]
  accounts: Account[]
  recent: Transaction[]
}

declare global {
  interface Window {
    api: {
      getFamilyMembers: () => Promise<FamilyMember[]>
      addFamilyMember: (member: Omit<FamilyMember, 'id' | 'name' | 'created_at'>) => Promise<FamilyMember>
      updateFamilyMember: (id: number, member: Partial<FamilyMember>) => Promise<FamilyMember>
      deleteFamilyMember: (id: number) => Promise<void>
      pickProfileImage: () => Promise<string | null>
      getAccounts: () => Promise<Account[]>
      addAccount: (account: any) => Promise<Account>
      updateAccount: (id: number, account: any) => Promise<Account>
      deleteAccount: (id: number) => Promise<void>
      getTransactions: (filters?: any) => Promise<{ rows: Transaction[]; total: number }>
      addTransaction: (tx: any) => Promise<Transaction>
      updateTransaction: (id: number, tx: any) => Promise<Transaction>
      deleteTransaction: (id: number) => Promise<void>
      getCategories: () => Promise<Category[]>
      addCategory: (cat: any) => Promise<Category>
      deleteCategory: (id: number) => Promise<void>
      getExpenses: () => Promise<Expense[]>
      addExpense: (expense: any) => Promise<Expense>
      updateExpense: (id: number, expense: any) => Promise<Expense>
      deleteExpense: (id: number) => Promise<void>
      getNonPetMembers: () => Promise<FamilyMember[]>
      getDashboardData: () => Promise<DashboardData>
      getBills: () => Promise<Bill[]>
      addBill: (bill: any) => Promise<Bill>
      updateBill: (id: number, bill: any) => Promise<Bill>
      deleteBill: (id: number) => Promise<void>
      payBill: (id: number) => Promise<Bill>
      getBudgets: () => Promise<Budget[]>
      addBudget: (b: any) => Promise<Budget>
      updateBudget: (id: number, b: any) => Promise<Budget>
      deleteBudget: (id: number) => Promise<void>
      getGoals: () => Promise<Goal[]>
      addGoal: (g: any) => Promise<Goal>
      updateGoal: (id: number, g: any) => Promise<Goal>
      deleteGoal: (id: number) => Promise<void>
      contributeToGoal: (id: number, amount: number) => Promise<Goal>
      getNetWorth: () => Promise<NetWorthData>
      takeNetWorthSnapshot: () => Promise<NetWorthSnapshot>
      getSavingsData: () => Promise<SavingsData>
      addSavingsContribution: (payload: { account_id: number; amount: number; date: string; description?: string; notes?: string }) => Promise<Transaction>
    }
  }
}
