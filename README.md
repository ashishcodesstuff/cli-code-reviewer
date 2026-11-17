# 🛡️ AI PR Reviewer

A CLI that reviews your staged git changes with an LLM before you commit. It runs security scans, flags missing tests, suggests refactors, and can apply fixes with your approval. It works with any OpenAI-compatible endpoint, so **you decide where your code goes**: a model on your own machine (LM Studio, Ollama, vLLM) or a hosted API.

> **Learning project.** This was built to learn AI-engineering patterns: structured LLM output, schema validation, hybrid deterministic + LLM checks, and human-in-the-loop design. See [Known Limitations](#-known-limitations).

---

## 🔒 Privacy: You Choose the Endpoint

The tool sends your staged diff to whatever endpoint you configure:

| Mode | How to enable | Where your diff goes |
| --- | --- | --- |
| **Local** | Set `SERVER_URL` to a local server (e.g. `http://localhost:1234/v1`) | Stays on your machine. Works fully offline. |
| **Hosted** | Leave `SERVER_URL` unset (uses the OpenAI API) or point it at another hosted provider | Sent to that provider. Check their data-handling terms before using it on proprietary code. |

Both modes use the same code path and the same `.env` file. Switching is a one-line change.

---

## ✨ Features

* **Local or Hosted, Your Call:** Built on the standard OpenAI-compatible API. Use LM Studio, Ollama, vLLM, or a hosted provider by changing environment variables.
* **Hybrid Guardrail Pattern:** Deterministic Node.js checks (file filtering, extension and lockfile blacklisting, test-file detection) run alongside probabilistic LLM analysis for semantic and security review.
* **Security Review with File Attribution:** Flags hardcoded secrets, weak cryptography, injection risks, and missing authorization, and ties each finding to its file path.
* **Schema-Validated Output:** Requests JSON from the model, sanitizes the response, and validates it against a **Zod** schema, so malformed output fails loudly instead of silently.
* **Config Validation:** Environment variables are validated with Zod at startup, and a missing or invalid value is reported by name.
* **Prompt-Injection Hardening (best effort):** The diff is wrapped in `<untrusted_diff>` tags and the model is told to treat it as data, not instructions.
* **Large Diff Handling:** When more than 3 files are staged, the diff is reviewed one file at a time and the results are merged (highest risk wins, findings de-duplicated, token counts summed). Diffs touching 3 files or fewer are sent in a single request.
* **Interactive Auto-Remediation:** The model proposes exact replacements (`originalCode` → `suggestedEdit`) and asks before applying anything to your workspace.
* **Safe Commit Aborting:** After fixes are applied, the commit is halted (`process.exit(1)`) so you can inspect `git diff`, re-stage, and commit with confidence.
* **Terminal UI:** Color-coded output with `kleur`, `ora`, and `boxen`.
* **Demo Video:** https://youtu.be/ywLPHzqt1Gs
* **Demo Video 2:** https://youtu.be/3Mx7Ljnxbcs

---

## 🛠️ Tech Stack

* **Language:** TypeScript (Node.js, ESM)
* **Validation:** Zod
* **AI Integration:** OpenAI SDK (works with any OpenAI-compatible endpoint)
* **Terminal UI:** kleur, ora, boxen, enquirer

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js 22+** (required by the current versions of the OpenAI SDK, `ora`, and `boxen`).
2. An LLM endpoint, either:
   * **Local:** a server with an OpenAI-compatible API (LM Studio, Ollama, vLLM, LocalAI) and a code-capable open-weight model loaded (e.g. `qwen2.5-coder`), or
   * **Hosted:** an API key for an OpenAI-compatible provider.

### Build and Link the CLI

Clone this repository, then:

```bash
npm install
npm run build   # compiles TypeScript to dist/
npm link        # makes `local-pr-review` available globally
```

---

## ⚙️ Configuration

Create a `.env` file in the root of the **project you want to review** (not in this repo):

| Variable | Required | Description |
| --- | --- | --- |
| `REVIEWER_MODEL` | Yes | Model name to use, as your server or provider lists it. |
| `SERVER_API_KEY` | Yes | API key. Local servers usually ignore it, but a non-empty placeholder is still required. |
| `SERVER_URL` | No | Base URL of an OpenAI-compatible endpoint. If unset, the OpenAI API is used. |

### Example: local model (LM Studio)

```env
SERVER_URL=http://localhost:1234/v1
REVIEWER_MODEL=qwen2.5-coder
SERVER_API_KEY=local
```

### Example: local model (Ollama)

```env
SERVER_URL=http://localhost:11434/v1
REVIEWER_MODEL=qwen2.5-coder
SERVER_API_KEY=ollama
```

### Example: hosted (OpenAI API)

```env
# SERVER_URL left unset: requests go to the OpenAI API
REVIEWER_MODEL=<model-name>
SERVER_API_KEY=<your-openai-api-key>
```

> ⚠️ **Heads-up:** if `SERVER_URL` is missing or misspelled, your diff is sent to the hosted default. When privacy matters, check that it points where you expect.

Never commit your `.env` file. Add it to `.gitignore`.

---

## 💻 Usage

### Manual run

Inside any git repository with staged changes:

```bash
local-pr-review
```

### Automatic pre-commit hook (Husky)

1. Initialize Husky in your target project:

   ```bash
   npx husky init
   ```

2. Edit `.husky/pre-commit` so it contains:

   ```sh
   exec < /dev/tty
   local-pr-review
   ```

   (`exec < /dev/tty` reconnects the terminal so the interactive prompt works inside a git hook.)

On each commit the tool scans your staged diff, prints a report with findings attributed to files, and offers remediations. It blocks the commit if it finds HIGH or MEDIUM risk issues, and after any remediation prompt so you can review and re-stage.

---

## 🧪 Running Evals

The eval suite runs fixture diffs through the **real model you have configured** and checks risk levels, missing-test detection, and remediation output:

```bash
npm run eval
```

Because LLM output is non-deterministic, results can vary between runs and between models. You need a working `.env` before running it.

The same file also contains unit tests for diff splitting and chunk merging. They don't call the model, but they still need a valid `.env` because the file imports the reviewer module.

---

## 📂 Project Structure

```text
.
├── src/
│   ├── index.ts                      # CLI entry point, header, spinner, terminal UI
│   ├── importEnvConfig.ts            # Loads and validates environment variables (Zod)
│   ├── diffChunker.ts                # Splits a diff into per-file chunks
│   ├── processAndMergeChunks.ts      # Merges per-file review results into one report
│   ├── git.ts                        # Captures staged diff and file list; filters binaries and lockfiles
│   ├── reviewer.ts                   # Core engine: model pre-flight check, LLM call, JSON parsing, Zod validation
│   ├── createPrompt.ts               # Builds the system and user prompts
│   ├── findMissingTestFiles.ts       # Deterministic check for missing test files
│   ├── createPrettifiedResult.ts     # Formats review results for the terminal
│   └── promptUserForRemediation.ts   # Interactive prompt that applies suggested fixes
├── tests/
│   ├── fixtures/                     # Sample diffs for evals
│   └── eval.test.ts                  # Model evals plus chunking/merge unit tests
├── architecture.md                   # Architecture and data flow
├── package.json                      # Dependencies, scripts, bin entry
└── tsconfig.json                     # TypeScript (NodeNext ESM) config
```

See [architecture.md](./architecture.md) for the data-flow diagram.

---

## ⚠️ Known Limitations

This is a learning project, and these are known gaps:

* **LLM output is probabilistic.** It can miss real issues and flag harmless code. Treat results as a second pair of eyes, not a replacement for review or a dedicated secret scanner.
* **Auto-remediation is a string replace.** If the model's `originalCode` doesn't match the file exactly, the fix is skipped. Always review changes with `git diff`.
* **Chunking is by file count, not token budget.** Diffs touching 3 files or fewer are sent whole, and a single file is never split, so one very large file can still exceed the model's context window.
* **Any offered fix halts the commit.** If the model proposes remediations, the commit is stopped after the prompt (whether you accept or decline), even when the risk level is LOW.
* **Prompt injection is only partly mitigated.** The `<untrusted_diff>` wrapper helps but is not a guarantee.
* **Interactive only.** The prompt needs a terminal (`/dev/tty`), so there is no non-interactive CI mode and Windows is untested.
* **Quality depends on the model.** Small local models are weaker at security reasoning than larger ones.

---

## 📜 License

Open-source under the **GNU GPL-3.0-or-later** license.
