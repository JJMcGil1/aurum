# Moxby Rules

This file is the cross-CLI source of truth for aurum. Keep it under 200 lines.
For non-trivial work, read this file first, then load only the linked docs needed for the task.

## Project Snapshot

| Item | Value |
|------|-------|
| Tech stack | React, Vite, TypeScript, Electron |
| Package manager | npm |
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Test | TBD - inspect project files and update |
| Lint | TBD - inspect project files and update |
| Typecheck | TBD - inspect project files and update |
| App entry points | TBD - list main app/server entry files |

## ToC

| Area | Doc | When to Read |
|------|-----|--------------|
| Feature Docs | `.moxby/features/<feature>.md` | Moderate feature work, bug fixes, and repeated requests |
| Architecture Docs | `.moxby/architecture/<decision>.md` | Core data flow, prompt routing, storage, auth, or integration changes |
| Design System | `.moxby/design.md` | UI, interaction, component, and visual design work |

## Coding Process

- Clarify before planning when requirements, mechanics, or acceptance criteria are ambiguous.
- Plan moderate work as tracer bullets: thin vertical slices that verify the real end-to-end path.
- Prefer TDD for bugs and behavior changes: failing test, repro, or log evidence first when feasible.
- Do not hide root causes behind silent fallbacks. Any resilience path must surface the original failure.
- Prefer deep modules with simple interfaces over shallow one-function modules with tangled dependencies.
- Keep code files generally under 500-750 lines; split by responsibility when a file grows past that range.
- Reuse existing helpers and optimize memory/CPU when it reduces real repeated work or complexity.
- Use dynamic programming, memoization, caching, or batching only when repeated subproblems or measurements justify it.
- Run terminal commands yourself instead of asking the user to run commands you can run.
- For moderate feature or bug work, create or update the relevant `.moxby/features/<feature>.md`.
- Use agent teams for moderate or complex work.
- Verify with targeted tests, builds, logs, or reproduction commands before reporting done.
- After moderate fixes, bug fixes, backend/database changes, or architecture-flow work, offer a flow diagram or similar visual explanation.
- Before editing a UI component, take a mental inventory of its user-facing affordances (menu items, buttons, sections, props consumed) and preserve them through the edit. Removing or renaming an affordance must be intentional, never an incidental side effect of a refactor.

## Feature Doc Requirements

- Store feature docs in `.moxby/features/`.
- Include the PRD or requirement summary, file trace, upstream/downstream dependencies, data flow, acceptance criteria, and verification.
- Do not create a global `bugs.md`; bug context belongs in the relevant feature doc and issue/PR history.

## Architecture Doc Rules

- Read relevant docs in `.moxby/architecture/` before changing cross-cutting flows, data models, database schema, auth, API contracts, background jobs, deployment, integrations, prompt/tool routing, or shared state.
- Create or update an architecture doc when a change affects multiple features, module boundaries, persistent data, backend/database flow, security/performance assumptions, or future implementation choices.
- Keep architecture docs concise: decision, context, file trace, upstream/downstream impact, and verification. Do not use them as running logs.

## Context Discipline

- Treat this file as the map, not the whole context payload.
- Read only the feature, design, or architecture docs needed for the task.
- For UI work, use an existing `.moxby/design.md`; if it is missing or generic, inspect repo styling and update it before implementing design changes.
- Keep execution context lean, roughly under 100k tokens when possible; start a fresh session for distinct implementation tasks instead of relying on compaction.
- Keep durable docs concise and prune stale details. Feature docs are not running logs.
- Keep native CLI files as pointers or local supplements, not duplicated rule sources.
