## 🏗️ System Architectural Flow

The diagram below illustrates how data flows through your privacy-first local AI code review pipeline:

```text
[ Developer Workspace ]
         │
         ▼ (Git modifications / `git commit` via Husky)
┌─────────────────────────┐
│     src/index.ts        │ ──► Starts CLI, initializes Spinner (ora)
└───────────┬─────────────┘
            │
            ▼ Calls getLocalGitChanges()
┌─────────────────────────┐
│      src/git.ts         │ ──► Executes git commands, extracts raw diff & file list
└───────────┬─────────────┘ ──► Filters out unnecessary files (lockfiles, docs, assets)
            │
            ├──────────────────────────────────────────┐
            ▼ (Filtered Diff Text)                     ▼ (Changed Files List)
┌─────────────────────────────────┐        ┌───────────────────────────────────┐
│         src/reviewer.ts         │        │    Deterministic Helper Logic     │
│  (LLM Security & Quality Check) │        │  - Checks disk for .test/.spec    │
└───────────┬─────────────────────┘        └───────────┬───────────────────────┘
            │                              │
            ▼ Returns LLM JSON             ▼ Returns deterministic array
┌──────────────────────────────────────────────────────────────────────────────┐
│                                Result Merger                                 │
│    Combines LLM JSON (security, refactors, optional remediations)            │
│    + Deterministic missingTestFiles                                          │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼ Validates merged object
┌─────────────────────────────────┐
│        Zod Schema Check         │ ──► Validates structure against ReviewSchema
└───────────┬─────────────────────┘     (remediations optional / default [])
            │
            ▼ Returns typed ReviewResult
┌─────────────────────────────────┐
│          src/index.ts           │ ──► Renders polished terminal output via boxen & kleur
└───────────┬─────────────────────┘
            │
            ▼ Checks for optional `remediations` array
┌─────────────────────────────────┐
│    Interactive Prompt Logic     │ ──► Pauses CLI (tied via `/dev/tty` fallback/husky)
│  (Prompt user: Apply fixes?)    │ ──► Asks user to confirm auto-remediation (y/n)
└───────────┬─────────────────────┘
            │
            ├──────────────────────────────────────────┐
            ▼ (If User Approves: "y")                  ▼ (If User Declines or Risk is High)
┌─────────────────────────────────┐        ┌───────────────────────────────────┐
│       Local File Patching       │        │          Commit Aborted           │
│  - Reads target source file     │        │  - Prints warning / block message │
│  - Replaces `originalCode`      │        │  - `process.exit(1)`              │
│    with `suggestedEdit`         │        └───────────────────────────────────┘
│  - Writes updated content       │
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│    Abort & Manual Review        │ ──► Exits with `process.exit(1)` to halt commit
│  - Workspace contains patches   │ ──► Developer runs `git diff`, re-stages, & commits
└─────────────────────────────────┘
```
