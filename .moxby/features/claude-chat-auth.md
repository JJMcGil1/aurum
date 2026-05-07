# Claude Chat Auth

Wire the Aurum Chat panel (`src/pages/Chat.tsx`) to Anthropic's `claude` CLI so users can authenticate with their Claude account and send real prompts. Architecture mirrors the Moxby model: Aurum never owns the primary credential — it shells out to the user's `claude` binary and reads whatever the CLI wrote.

## Requirements

- Detect whether the `claude` binary is installed (looking in PATH plus common install dirs that GUI apps miss).
- Detect whether the user is authenticated (macOS keychain entry `Claude Code-credentials`, or `~/.claude/.credentials.json` on Linux/Windows).
- Provide a "Connect Claude" CTA in the chat panel when not authenticated; once authenticated, allow real prompts.
- Send prompts via `claude -p <prompt> --output-format json` and stream the assistant's reply back to the renderer.
- Re-check auth on app focus and after the connect flow completes.

## File trace

- `electron/claude-cli.ts` — binary resolution, auth detection, login orchestration, send-message helper. New module.
- `electron/main.ts` — registers `claude:*` IPC handlers.
- `electron/preload.ts` — exposes `window.claude` to the renderer.
- `src/pages/Chat.tsx` — renders auth state (not-installed / connect / connected), wires send to the CLI.
- `src/styles.css` — auth banner / connect-button styling.
- `src/types/index.ts` — `window.claude` ambient typings.

## Upstream / downstream

- Upstream: Anthropic `claude` CLI (managed by user, not Aurum). macOS keychain.
- Downstream: Chat UI message thread.

## Auth detection

| Platform | Source of truth |
|----------|-----------------|
| macOS    | `security find-generic-password -s "Claude Code-credentials"` exit 0 |
| Other    | `~/.claude/.credentials.json` exists and parses |

Auth ownership stays with the CLI — no bridge file, no keychain writes from Aurum.

## Login flow

1. Renderer calls `claude:startLogin`.
2. Main spawns `<binary>` with the login slash command. Watches stdout/stderr.
3. Regex-scans output for `https://(claude\.ai|console\.anthropic\.com)/...` URLs only (host whitelist).
4. Opens the matched URL via `shell.openExternal`.
5. Polls auth every 2s up to 60 ticks (120s).
6. On detection, kills the child and emits `claude:login-complete`.
7. If no URL appears within 8s, emit `claude:login-needs-terminal` so the UI can fall back to a "run `claude` in your terminal, then click Recheck" affordance.

## Send flow

`claude:sendMessage(prompt, sessionId?)` →
spawn `<binary> -p <prompt> --output-format json [--resume <sessionId>]`,
parse the trailing JSON envelope, return `{ text, sessionId, durationMs }`.

## Acceptance criteria

- Fresh launch with `claude` already authenticated shows the prompt UI immediately (no flicker, no Connect button).
- Fresh launch without auth shows a Connect button. Clicking it opens the OAuth URL in the system browser. Completing OAuth flips the panel to authed within ~2s of the keychain entry appearing.
- "Recheck" is visible during pending login so a user who authed in another terminal can resume.
- Sending a prompt produces an assistant reply rendered in the same bubble layout as today's placeholder.
- Errors (binary missing, prompt failure) show a non-fatal inline error, not a dialog.

## Verification

- `npm run build` (typecheck + bundle).
- Manual: cold start authed, cold start unauthed, send "What is 2+2?" and confirm a real reply.
