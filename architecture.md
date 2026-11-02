## 🏗️ System Architectural Flow

The diagram below illustrates how data flows through your privacy-first local AI code review pipeline:

```text
 [ Developer Workspace ]
          │
          ▼ (Git modifications)
┌─────────────────────────┐
│     src/index.ts        │ ──► Starts CLI, initializes Spinner (ora)
└───────────┬─────────────┘
            │
            ▼ Calls getLocalGitChanges()
┌─────────────────────────┐
│      src/git.ts         │ ──► Executes:
└───────────┬─────────────┘     1. git diff HEAD~1 (or pass any branch name) (raw diff text)
            │                   2. git diff --name-only HEAD~1 (or pass any branch name) (changed files list)
            │
            ├──────────────────────────────────────────┐
            ▼ (Raw Diff Text)                          ▼ (Changed Files List)
┌─────────────────────────────────┐        ┌───────────────────────────────────┐
│         src/reviewer.ts         │        │    Deterministic Helper Logic     │
│  (LLM Security & Quality Check) │        │  - Filters out .md, .txt, etc.    │
└───────────┬─────────────────────┘        │  - Checks disk for .test/.spec    │
            │                              └───────────┬───────────────────────┘
            ▼ Returns LLM JSON                         ▼ Returns deterministic array
┌──────────────────────────────────────────────────────────────────────────────┐
│                              Result Merger                                   │
│  Combines LLM JSON (security & refactors) + Deterministic missingTestFiles   │
└──────────────────────────────────────┬───────────────────────────────────────┘
                                       │
                                       ▼ Validates merged object
┌─────────────────────────────────┐
│        Zod Schema Check         │ ──► Validates structure against ReviewSchema
└───────────┬─────────────────────┘
            │
            ▼ Returns typed ReviewResult
┌─────────────────────────────────┐
│          src/index.ts           │ ──► Renders polished terminal output via boxen & kleur
└─────────────────────────────────┘
```
