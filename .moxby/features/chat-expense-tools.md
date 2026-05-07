# Chat Expense Tools (MCP)

Give the in-app Aurum chat real access to the user's finance data so it can answer questions about who is in the family and what they've spent — instead of speculating. Built on the Model Context Protocol (MCP), Claude Code's native tool extension mechanism.

## Requirements

- When the user sends a chat message, Claude must be able to call read-only tools that query the local Aurum SQLite DB.
- Tools cover the expenses domain only (no writes, no other features yet): family roster, expense list/details, totals, monthly trends, top expenses, breakdowns by payer, and totals for a given beneficiary.
- Tool execution must auto-run (no permission prompts) since `-p` is non-interactive.
- Must work in dev (electron in node_modules) and packaged production (asar). No dependency on user-installed Node.

## Architecture

```
┌──────────────────────┐  ipc       ┌────────────────────┐  spawn   ┌──────────────┐  stdio   ┌──────────────────────┐
│ Renderer (Chat.tsx)  │──sendMsg──▶│ electron/claude-cli│─────────▶│ claude -p    │─────────▶│ aurum-mcp-server.js  │
└──────────────────────┘            └────────────────────┘          │ (Anthropic)  │          │ (Electron-as-Node)   │
                                                                    └──────────────┘          │ readonly aurum.db    │
                                                                                              └──────────────────────┘
```

- The MCP subprocess runs `process.execPath` (the Electron binary) with `ELECTRON_RUN_AS_NODE=1`, so we don't ship a separate Node runtime.
- It opens `aurum.db` read-only with WAL — concurrent with the main app's writer.
- Tool surface is locked down via `--strict-mcp-config` + `--allowedTools mcp__aurum__*` + `--permission-mode bypassPermissions`.

## File trace

- `electron/aurum-mcp-server.ts` — stdio JSON-RPC MCP server, expense tool implementations.
- `electron/claude-cli.ts` — `configureAurumTools()` setter; `sendMessage` pushes `--mcp-config`, `--allowedTools`, `--permission-mode`, `--append-system-prompt` when context is set.
- `electron/main.ts` — calls `configureAurumTools` after DB init, passing `db.dbPath` and the compiled MCP server path.
- `electron/database.ts` — exposes `dbPath` on the `Database` instance.
- `vite.config.ts` — third electron entry compiles the MCP server to `dist-electron/aurum-mcp-server.js` (better-sqlite3 externalized).

## Tools exposed

| Name | Purpose |
|------|---------|
| `list_family_members` | Family roster (id, name, role, email). |
| `list_expenses` | Recent expenses with optional filters: name substring, member (payer/beneficiary), month. |
| `get_expense` | Full payer/beneficiary breakdown for one expense id. |
| `expense_summary` | Lifetime total, count, avg, current vs previous month. |
| `spending_by_member` | Per-payer totals across all-time or a month. |
| `spending_for_member` | Total spent on a beneficiary, with per-expense detail. |
| `monthly_trend` | Last N months of totals (default 6, max 36). |
| `top_expenses` | Largest individual expenses, optionally for a month. |

All tool inputs are validated by JSON Schema; month filters accept `current`, `last`, or `YYYY-MM`.

## System prompt

`AURUM_SYSTEM_PROMPT` in `claude-cli.ts` instructs Claude to always call these tools for finance questions, parallelize when independent, and never fabricate numbers. Sent via `--append-system-prompt`.

## Verification

- `npm run build` clean (typecheck + 3 vite electron entries).
- Smoke test: piped `initialize`/`tools/list`/`tools/call` JSON-RPC into the compiled MCP server with `AURUM_DB_PATH` set — handshake succeeds, all tools return real rows from the live DB.
- End-to-end: invoked `claude -p "Who's in my family?"` with `--mcp-config` pointing at our server. Claude executed `mcp__aurum__list_family_members` and returned the three live members with their roles.
