export interface FamilyMember {
  id: number
  first_name: string
  last_name: string
  name: string // computed: first_name + last_name
  email: string | null
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
      listChatThreads: () => Promise<ChatThreadSummary[]>
      getChatThread: (id: string) => Promise<{ thread: ChatThreadRow; messages: ChatMessageRow[] } | null>
      createChatThread: (payload: { id: string; title: string; model: string | null }) => Promise<ChatThreadRow>
      updateChatThread: (id: string, fields: Partial<{ title: string; claude_session_id: string | null; model: string | null; touch: boolean }>) => Promise<ChatThreadRow>
      deleteChatThread: (id: string) => Promise<void>
      saveChatMessage: (payload: ChatMessageRow) => Promise<void>
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
    claude: {
      getStatus: () => Promise<ClaudeStatus>
      startLogin: () => Promise<void>
      cancelLogin: () => Promise<void>
      signOut: () => Promise<{ ok: boolean; message?: string }>
      sendMessage: (
        prompt: string,
        options?: { sessionId?: string | null; model?: string | null },
      ) => Promise<ClaudeSendResult>
      streamMessage: (
        requestId: string,
        prompt: string,
        options?: { sessionId?: string | null; model?: string | null },
      ) => Promise<void>
      cancelStream: (requestId: string) => Promise<void>
      listAurumTools: () => Promise<{ name: string; description: string }[]>
      onStreamEvent: (cb: (data: { requestId: string; payload: ClaudeStreamPayload }) => void) => () => void
      onLoginEvent: (cb: (data: ClaudeLoginEvent) => void) => () => void
    }
  }
}

export interface ClaudeStatus {
  installed: boolean
  authenticated: boolean
  binaryPath: string | null
  version: string | null
  error?: string
}

export interface ClaudeSendResult {
  text: string
  sessionId: string | null
  durationMs: number
  model: string | null
  costUsd: number | null
  inputTokens: number | null
  outputTokens: number | null
}

export type ClaudeLoginEvent =
  | { kind: 'url'; url: string }
  | { kind: 'needs-terminal' }
  | { kind: 'success' }
  | { kind: 'cancelled' }
  | { kind: 'timeout' }
  | { kind: 'error'; message: string }

export type ClaudeStreamBlock =
  | { kind: 'text' }
  | { kind: 'thinking' }
  | { kind: 'tool_use'; id: string; name: string; input: any }
  | { kind: 'unknown'; raw: any }

export interface ChatThreadRow {
  id: string
  title: string
  claude_session_id: string | null
  model: string | null
  created_at: string
  updated_at: string
}

export interface ChatThreadSummary extends ChatThreadRow {
  message_count: number
}

export interface ChatMessageRow {
  id: string
  thread_id: string
  role: 'user' | 'assistant'
  status: string
  blocks_json: string
  meta_json: string | null
  error: string | null
  created_at_ms: number
  ord: number
}

export type ClaudeStreamPayload =
  | { type: 'session_init'; sessionId: string; model: string | null }
  | { type: 'message_start'; messageId: string }
  | { type: 'block_open'; messageId: string; index: number; block: ClaudeStreamBlock }
  | { type: 'text_delta'; messageId: string; index: number; text: string }
  | { type: 'thinking_delta'; messageId: string; index: number; text: string }
  | { type: 'tool_input_delta'; messageId: string; index: number; partialJson: string }
  | { type: 'block_close'; messageId: string; index: number; finalInput?: any }
  | { type: 'message_stop'; messageId: string }
  | { type: 'tool_result'; toolUseId: string; text: string; isError?: boolean }
  | {
      type: 'result'
      sessionId: string | null
      durationMs: number
      model: string | null
      costUsd: number | null
      inputTokens: number | null
      outputTokens: number | null
    }
  | { type: 'error'; message: string }
  | { type: 'closed' }
