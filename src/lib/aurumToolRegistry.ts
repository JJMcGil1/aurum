import {
  Users,
  ListChecks,
  Receipt,
  TrendingUp,
  PieChart,
  ArrowUpRight,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/**
 * Single source of presentational metadata for the MCP tools advertised
 * by the Aurum server. Keyed by the bare tool name (without the
 * `mcp__aurum__` prefix). Tool *descriptions* come live from the MCP
 * server's tools/list response — only labels and icons live here, since
 * those are display-only choices that don't belong in the server.
 */
export interface ToolPresentation {
  label: string
  Icon: LucideIcon
}

const REGISTRY: Record<string, ToolPresentation> = {
  list_family_members: { label: 'Family roster', Icon: Users },
  list_expenses: { label: 'Listing expenses', Icon: ListChecks },
  get_expense: { label: 'Expense detail', Icon: Receipt },
  expense_summary: { label: 'Spending summary', Icon: PieChart },
  spending_by_member: { label: 'Spending by member', Icon: PieChart },
  spending_for_member: { label: 'Spending for member', Icon: Receipt },
  monthly_trend: { label: 'Monthly trend', Icon: TrendingUp },
  top_expenses: { label: 'Top expenses', Icon: ArrowUpRight },
}

export function bareToolName(full: string): string {
  // mcp__aurum__list_expenses → list_expenses
  const m = /^mcp__[^_]+__(.+)$/.exec(full)
  return m ? m[1] : full
}

export function presentTool(fullOrShort: string): ToolPresentation {
  const short = bareToolName(fullOrShort)
  return REGISTRY[short] ?? { label: short, Icon: Wrench }
}
