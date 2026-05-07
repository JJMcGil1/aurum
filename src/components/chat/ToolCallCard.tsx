import { useState } from 'react'
import {
  ChevronDown,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react'
import { FamilyMembersCard } from './tools/FamilyMembersCard'
import { ExpensesListCard } from './tools/ExpensesListCard'
import { ExpenseSummaryCard } from './tools/ExpenseSummaryCard'
import { SpendingByMemberCard } from './tools/SpendingByMemberCard'
import { SpendingForMemberCard } from './tools/SpendingForMemberCard'
import { MonthlyTrendCard } from './tools/MonthlyTrendCard'
import { ExpenseDetailCard } from './tools/ExpenseDetailCard'
import { bareToolName, presentTool } from '@/lib/aurumToolRegistry'

export type ToolCallStatus = 'running' | 'done' | 'error'

export interface ToolCall {
  id: string
  name: string
  input?: any
  status: ToolCallStatus
  resultText?: string
  resultJson?: any
}

export function ToolCallCard({ tool }: { tool: ToolCall }) {
  const [open, setOpen] = useState(true)
  const short = bareToolName(tool.name)
  const meta = presentTool(short)
  const Icon = meta.Icon

  return (
    <div className={`tool-card tool-card-${tool.status}`}>
      <button
        type="button"
        className="tool-card-header"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span className="tool-card-icon">
          <Icon size={14} />
        </span>
        <span className="tool-card-title">{meta.label}</span>
        <StatusBadge status={tool.status} />
        <ChevronDown
          size={14}
          className="tool-card-chev"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {open && (
        <div className="tool-card-body">
          {hasArgs(tool.input) && <ArgsLine input={tool.input} />}
          {tool.status === 'running' && <RunningPlaceholder />}
          {tool.status === 'error' && (
            <div className="tool-card-error">
              <AlertTriangle size={14} /> {tool.resultText ?? 'Tool error'}
            </div>
          )}
          {tool.status === 'done' && renderResult(short, tool.resultJson, tool.resultText)}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ToolCallStatus }) {
  if (status === 'running')
    return (
      <span className="tool-badge tool-badge-run">
        <Loader2 size={11} className="tool-badge-spin" /> running
      </span>
    )
  if (status === 'error')
    return (
      <span className="tool-badge tool-badge-err">
        <AlertTriangle size={11} /> error
      </span>
    )
  return (
    <span className="tool-badge tool-badge-ok">
      <CheckCircle2 size={11} /> done
    </span>
  )
}

function hasArgs(input: any): boolean {
  return input && typeof input === 'object' && Object.keys(input).length > 0
}

function ArgsLine({ input }: { input: any }) {
  const parts: string[] = []
  for (const [k, v] of Object.entries(input)) {
    if (v == null || v === '') continue
    parts.push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  }
  if (!parts.length) return null
  return <div className="tool-card-args">{parts.join(' · ')}</div>
}

function RunningPlaceholder() {
  return (
    <div className="tool-card-skeleton">
      <div className="tool-skel-row" />
      <div className="tool-skel-row" />
      <div className="tool-skel-row" />
    </div>
  )
}

function renderResult(short: string, json: any, raw?: string) {
  if (!json && raw) {
    try { json = JSON.parse(raw) } catch { /* leave undefined */ }
  }
  if (!json) return <div className="tool-card-empty">No result.</div>

  switch (short) {
    case 'list_family_members':
      return <FamilyMembersCard result={json} />
    case 'list_expenses':
    case 'top_expenses':
      return <ExpensesListCard result={json} />
    case 'get_expense':
      return <ExpenseDetailCard result={json} />
    case 'expense_summary':
      return <ExpenseSummaryCard result={json} />
    case 'spending_by_member':
      return <SpendingByMemberCard result={json} />
    case 'spending_for_member':
      return <SpendingForMemberCard result={json} />
    case 'monthly_trend':
      return <MonthlyTrendCard result={json} />
    default:
      return <pre className="tool-card-raw">{JSON.stringify(json, null, 2)}</pre>
  }
}
