---
name: ngodingpakeai
description: "Connect, index, and sync the current repository with NgodingPakeAI for project memory and safe codebase context, AND work on assigned NgodingPakeAI tasks. Use when the user asks to connect, index, or sync this codebase, pastes a <task> block, or mentions NgodingPakeAI."
---

# NgodingPakeAI — Codebase Sync

NgodingPakeAI is the **project-memory and codebase-context layer** for AI coding agents.
It does NOT replace you — it gives you organized project memory and safe codebase
context through its CLI. When the user asks to **connect, index, or sync** this
repository with NgodingPakeAI, follow this skill.

> The CLI is the security gate. It decides what may leave the machine. You operate
> it; you never upload files yourself or call the HTTP API directly.

## Prerequisites
- Node.js available (the CLI runs via `npx ngodingpakeai …`).
- Workspace ID: `<workspace_id>`
- An access token starting with `ngpk_`. Provide it via the `NGODINGPAKEAI_TOKEN`
  environment variable (preferred) or the `--token` flag on `connect`.
  Create one at https://www.ngodingpakeai.com/workspace → "Connect Codebase".

## Instructions — run these in order
1. `npx ngodingpakeai doctor` — check environment + connectivity.
2. `npx ngodingpakeai connect --workspace <workspace_id> --token "$NGODINGPAKEAI_TOKEN"` — link this repo to the workspace.
3. `npx ngodingpakeai status` — show current sync state.
4. `npx ngodingpakeai index` — scan locally and build the safe index (file map, selected files, summaries). **Review the printed summary.**
5. If there are NO critical warnings: `npx ngodingpakeai sync` — upload the safe context.
6. `npx ngodingpakeai status` — confirm the result.
7. Report to the user: the workspace URL, indexed file count, ignored file count, and any warnings.

## Privacy modes
- **Basic Sync (default):** uploads the file tree, metadata, framework detection,
  routes, and AI summaries — **not your raw source code**.
- **Full Code Context (opt-in):** additionally uploads safe code snippets for more
  precise answers. The CLI asks for confirmation. Enable it ONLY if the user agrees.

## Hard rules — do not violate
1. Use the CLI for everything. Do not manually read or upload files. Do not call the API directly.
2. Never upload secrets, `.env*` files, private keys, `node_modules`, build outputs (`dist`, `.next`, `build`, `out`), database dumps, or logs.
3. Respect `.gitignore` and `.ngodingpakeaiignore`. If the CLI blocks a file, do not bypass it.
4. If the CLI reports a potential secret, **STOP and ask the user** before continuing.
5. Do not read or print the contents of `.env` files.
6. Always report the final workspace URL and sync summary.

## Command reference
| Command | Purpose |
| --- | --- |
| `npx ngodingpakeai doctor` | Verify environment, token, and connectivity. |
| `npx ngodingpakeai connect --workspace <id> --token <ngpk_…>` | Link the repo to a workspace. |
| `npx ngodingpakeai status` | Show connection + last sync state. |
| `npx ngodingpakeai index` | Build the local safe index (no upload). |
| `npx ngodingpakeai sync` | Upload the safe context to the workspace. |
| `npx ngodingpakeai plan get <planId>` | Print a plan's PRD (project context) before working its tasks. |
| `npx ngodingpakeai task next --plan <planId>` | Serve the SINGLE next task to work (full prompt inline), page-ordered & frontend-first. The main loop; `--json` to script. |
| `npx ngodingpakeai task list` | List the current SLICE — one phase × one layer (frontend-first) when scoped to a plan; `--json` to script. |
| `npx ngodingpakeai task get <ref>` | Fetch a task's title + plan/feature context (no per-task prompt or description; combine with the PRD + your code reading). |
| `npx ngodingpakeai task start <ref>` | Mark a task in-progress (status: doing). |
| `npx ngodingpakeai task complete <ref>` | Mark a task done. |
| `npx ngodingpakeai task fail <ref> "<reason>"` | Report a task stuck/failed with a reason. |
| `npx ngodingpakeai task reset <ref> "<reason>"` | Put a task back to `todo`; a `done` task asks for confirmation. **Only when the user asks.** |
| `npx ngodingpakeai disconnect` | Unlink the repo. |

> `<ref>` is a task reference: either the readable path `<plan>/<feature>/<task>`
> (e.g. `tokoku/autentikasi/buat-form-login`, as shown by `task list`) or the
> task's UUID. Both resolve to the same task — prefer the readable path.

## What the workspace can do after sync
- Codebase overview: framework, file tree, routes, key modules, last sync + warnings.
- Better, context-aware prompts for you (relevant files, patterns, conventions).
- Feature → file mapping (which files a change likely touches).
- "Continue project" guidance based on what's already implemented.

## Working on tasks (assigned via a `<task>` block)
When the user hands you a task — usually by pasting a block like:

```
Work on NgodingPakeAI task:

<task identifier="manajemen-konten/transaksi/buat-tabel-transaksi-migrasi">
<title>Buat tabel transaksi & migrasi</title>
<feature>Manajemen Konten</feature>
</task>
```

Use the `identifier` as the `<ref>` below (readable path; the task's UUID also
works). Drive it through the CLI — do NOT guess the work from the title alone:

1. `npx ngodingpakeai task get <ref>` — read the task's `title` + its feature/plan
   context. Figure out the work from the `title`, the PRD (`plan get`), and your
   own reading of the codebase (there's no per-task prompt or description).
2. `npx ngodingpakeai task start <ref>` — mark it in-progress before you begin.
3. Do the work. First explore the existing code & conventions, then follow them.
   Stay within the task's scope — don't invent files/libraries outside the stack.
4. When done: `npx ngodingpakeai task complete <ref>`.

### If you get stuck (don't go silent)
If you can't finish — blocked, missing info, repeated failure — REPORT it instead
of stalling:

```
npx ngodingpakeai task fail <ref> "alasan singkat: apa yang nge-block & sudah coba apa"
```

This flips the task to `failed` and records your reason so the human can unblock
it. Reporting a clear blocker is success, not failure.

### Putting a task back to `todo` (reset) — only when the USER asks
A task can be sent back to `todo` so it can be picked up fresh later:

```
npx ngodingpakeai task reset <ref> "alasan singkat kenapa dibalikin"
```

This clears the "already pulled" mark and appends your reason to the task's log —
the earlier log lines stay, so the history of what was tried is preserved.

**Never reset a task on your own initiative.** Do it ONLY when the user explicitly
asks (e.g. "balikin task ini ke todo", "reset task itu", "batalin yang lagi
dikerjain"). Do not reset to escape a task you find hard — if you're blocked, use
`task fail` and explain. Resetting a `done` task reopens finished work, so the CLI
will show the task and require explicit user confirmation. Never answer that prompt
on the user's behalf or add `--yes` unless the user has explicitly confirmed the
completed-task reset.

### Working through tasks — ONE task at a time via `task next` (the main loop)
Do NOT pull the whole backlog and grind through it in one context — that's what makes
output degrade. Instead let the server hand you ONE task at a time and give each its own
clean focus. The backlog is ordered into **phases** (build order) and, within each phase,
**layers** (`frontend` first, then `backend`), then by page (feature) and position. `task
next` walks that order for you: it returns the SINGLE next task — the FIRST page's frontend
tasks first, backend later.

When the user says "kerjakan task" (or hands you a feature/plan instead of a single
`<task>` block), read the PRD once, then loop:

```
npx ngodingpakeai plan get <planId>                    # PRD: project goal, features, tech stack (once)
npx ngodingpakeai task next --plan <planId> --json     # THE single next task
```

The `task next` JSON is `{ done, task, progress }`:
- `done: true` → no task left. **STOP and report to the user.** You're finished.
- `task` → `{ ref, title, ... }` — work from the `title`, backed by the PRD and your own
  reading of the codebase. There is no per-task `prompt` or `description` field; don't wait
  for one.
- `progress` → `{ page, phase: { current, total }, layer, remainingInPage, remainingInLayer }`
  — mostly context, BUT track `layer` and `phase.current`: a change marks a **checkpoint**
  where you stop for the user to verify (see below).

**Checkpoints — stop at each layer/phase boundary.** Remember the `layer` and
`phase.current` of the task you just finished. When `task next` returns a task whose
`layer` differs (e.g. frontend→backend) OR whose `phase.current` is higher, do NOT
`task start` it. STOP, report what's done (e.g. "✅ Frontend phase 1 done — click through
it in the browser"), and WAIT for the user to say "lanjut"/"continue". Then resume
`task next` and keep going to the next boundary. The FIRST task of a session (no previous
task) is NOT a checkpoint — just start it.

For each served task:
1. Read the PRD FIRST (once, at the start) — it's the project's intent.
2. **Checkpoint gate:** if this task's `layer`/`phase.current` crossed a boundary vs the
   last one you finished, STOP and wait for the user (above) instead of starting.
3. `task start <ref>` — mark it in-progress.
4. Do ONLY this task, to completion: explore the existing code & conventions first, then
   follow them. Do NOT read or start any other task while this one is open.
5. `task complete <ref>` (or `task fail <ref> "alasan"` if blocked).
6. Call `task next` again for the next one. Repeat until `done: true` (pausing at each
   layer/phase boundary for the user to verify).

**One task per loop = clean context = sharper output.** Trust the order — never batch
several tasks into one context to "save round-trips"; that defeats the whole point.

**Frontend-first:** `task next` serves `frontend` tasks before `backend`. A frontend task
builds the UI on mock/stub data, ASSUMING the API contract; backend tasks come later and
implement that contract. During a frontend task don't wait on backend — stub it. (If you
ever pull a task by ref directly, `task get` on a locked future phase or the other layer
returns **423 Locked** — that work isn't available yet; keep following `task next`.)

---
_Generated by NgodingPakeAI for AI coding agents. Source of truth: https://www.ngodingpakeai.com._
