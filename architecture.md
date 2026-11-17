# 🏗️ Architecture

AI PR Reviewer reads your **staged git diff**, sends it to an OpenAI-compatible LLM endpoint, validates the response against a schema, shows a report, and can apply suggested fixes with your approval. The endpoint is whatever you configure: a local model server, or a hosted API when `SERVER_URL` is unset (see the README's privacy table).

## System Flow

```text
[ Developer Workspace ]
         │  `git commit` (via Husky hook) or manual `local-pr-review`
         ▼
┌──────────────────────────────────┐
│          src/index.ts            │ ──► Entry point. Importing reviewer.ts triggers config loading:
└───────────────┬──────────────────┘     src/importEnvConfig.ts reads .env and validates it with Zod
                │                        (invalid config → uncaught error, exit 1)
                ▼ Prints header, starts spinner, calls getLocalDiff()
┌──────────────────────────────────┐
│           src/git.ts             │ ──► `git diff --cached --name-only`
└───────────────┬──────────────────┘ ──► Drops binaries/assets/archives/fonts/media and lockfiles
                │                    ──► `git diff --cached` for the remaining files only
                │
                ├─► No reviewable changes ──► "Working tree is clean", exit 0
                │
                ▼ (diff text + changed-file list)
┌────────────────────────────────────────────────────────────────────────┐
│                      src/reviewer.ts · reviewCodeDiff()                 │
│                                                                        │
│  1. Preflight        client.models.list() to confirm the server is up  │
│  2. Deterministic    findMissingTestFiles(changedFiles)  (checks disk) │
│  3. Prompt           createPrompt(): system rules + diff wrapped in    │
│                      <untrusted_diff> tags                             │
│  4. LLM call         chat.completions.create → SERVER_URL endpoint     │
│                      (temperature 0.1, response_format: json_object)   │
│  5. Parse + validate strip code fences → JSON.parse → Zod ReviewSchema │
│  6. Merge            deterministic missingTestFiles overwrites the     │
│                      model's list; token/latency metrics attached      │
└───────────────┬────────────────────────────────────────────────────────┘
                │  Any failure above → "Review failed: …", exit 1
                ▼ FullReviewResponse { result, metrics }
┌──────────────────────────────────┐
│ src/createPrettifiedResult.ts    │ ──► Formats the report (kleur + boxen); index.ts prints it
└───────────────┬──────────────────┘
                │
                ├─► remediations present ──┐
                │                          ▼
                │          ┌────────────────────────────────────┐
                │          │ src/promptUserForRemediation.ts    │
                │          │  Lists fixes, asks "apply? (y/n)"  │
                │          │  (needs a TTY; the Husky hook      │
                │          │   runs `exec < /dev/tty`)          │
                │          └──────┬───────────────────┬─────────┘
                │            "y"  │                   │ "n" / Ctrl+C
                │                 ▼                   ▼
                │       Patch files in place    "No files were modified"
                │       (string replace)
                │                 │                   │
                │                 └─────────┬─────────┘
                │                           ▼
                │                 process.exit(1)  → commit halted
                │                 (user runs `git diff`, re-stages, commits again)
                │
                └─► no remediations
                       ├─ risk HIGH or MEDIUM ──► "Commit blocked", exit 1
                       └─ risk LOW ─────────────► exit 0, commit proceeds
```

## Exit Behavior

| Situation | Result | Exit code |
| --- | --- | --- |
| No reviewable staged changes | "Working tree is clean" | 0 |
| Invalid or missing `.env` values | Uncaught error at startup (stack trace) | 1 |
| Model unreachable, bad response, or schema failure | `Review failed: …` | 1 |
| Remediations offered, user applies them | Files patched; review and re-stage | 1 |
| Remediations offered, user declines or cancels | No files modified | 1 |
| No remediations, risk HIGH or MEDIUM | Commit blocked | 1 |
| No remediations, risk LOW | Commit proceeds | 0 |


## Design Decisions

* **Hybrid deterministic + probabilistic.** File filtering and test-file detection are plain code, because they are cheap, repeatable, and don't need a model. The LLM handles what code can't: security reasoning and refactor suggestions.
* **Schema-validated output.** Local models often wrap or malform JSON. The pipeline requests JSON mode, strips fences, parses, and validates with Zod, so bad output fails loudly instead of flowing into the UI.
* **Endpoint-agnostic.** The OpenAI SDK talks to any compatible server, so local and hosted models share one code path.
* **Human in the loop.** The model proposes exact `originalCode` → `suggestedEdit` replacements, but nothing is written without a confirmation.
* **Halt after patching.** Applied fixes abort the commit so the developer reviews `git diff` before anything is committed.
* **Diff treated as untrusted input.** Code under review may contain text that tries to steer the model, so it is delimited and the model is told to treat it as data. This reduces the risk but doesn't remove it.

## Known Gaps

* **Remediation patching.** Fixes use string replace on the first match. A snippet that doesn't match exactly is skipped, and replacement text containing `$` sequences (e.g. `$&`) can be altered by JavaScript's replace semantics. The model-provided `filePath` is not restricted to the changed files.
* **Remediations block even LOW-risk commits.** If the model offers any remediation, the prompt always ends in `process.exit(1)`, whatever the risk level.
* **Test-file detection is a heuristic.** It checks only for a sibling `name.test.ext` or `name.spec.ext`. Tests in `__tests__/` or a mirrored `tests/` tree are not found.
* **Preflight error handling.** Any failure of `models.list()` is reported as "Could not connect to local model server", which hides the real cause (for example a rejected API key on a hosted endpoint).
* **Config errors surface as a stack trace**, because the config loads when `reviewer.ts` is imported, before `main()` runs.
* **No CI mode.** The flow assumes an interactive terminal.
