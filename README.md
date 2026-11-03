# 🛡️ Local AI PR Reviewer

A lightning-fast, privacy-first CLI tool that performs automated code reviews, security scans, and test coverage checks locally on your machine using any OpenAI-compatible LLM endpoint (such as LM Studio, Ollama, or vLLM). 

Designed for developers who want automated guardrails and security checks on every git commit without leaking proprietary code to third-party cloud services.

---

## ✨ Features

* **100% Local & Privacy-First:** Runs entirely offline using your local LLM inference server. No code ever leaves your machine.
* **Backend-Agnostic:** Built on standard OpenAI-compatible APIs, allowing you to seamlessly swap models and local runtimes via environment variables.
* **Hybrid Guardrail Pattern:** Combines deterministic Node.js checks (file path filtering, extension blacklisting, and test file existence validation) with probabilistic AI analysis for deep semantic and security reviews.
* **Strict Security Guardrails & File Attribution:** Instantly flags hardcoded API keys, sensitive credentials, and common vulnerabilities, explicitly binding each finding to its exact file path.
* **Robust JSON Enforcement:** Uses advanced regex sanitization paired with **Zod** schema validation to eliminate parsing errors from local models.
* **Modern Terminal UI:** Built with bold branded headers, `kleur`, and `ora` for a clean, color-coded, professional developer experience.

---

## 🛠️ Tech Stack

* **Language:** TypeScript (Node.js ESM)
* **Validation:** Zod
* **AI Integration:** OpenAI SDK configured for local endpoints
* **Terminal UI:** Kleur, Ora

---

## 🚀 Getting Started & Installation

### Prerequisites

1. **Node.js** (v18+ recommended)
2. A local LLM server running an OpenAI-compatible API (e.g., LM Studio, Ollama, vLLM, or LocalAI) with an open-weight code model loaded (e.g., `qwen2.5-coder`).

### 1. Build and Link the CLI (In your CLI project repository)
Clone the repository, compile the TypeScript source code, and link the package globally:

```bash
# Install dependencies
npm install

# Build the project (compiles TS to JS in dist/)
npm run build

# Link the package globally so it's accessible anywhere in your terminal
npm link
```

---

## ⚙️ Configuration

### Environment Variables (In your Target Project)
This tool relies on your local LLM server. In the **source project repository** where you want to run code reviews, create a `.env` file at the root directory:

```env
# .env (place this in the root of the project you want to scan)
SERVER_URL=<your-server-endpoint>
REVIEWER_MODEL=<your-local-llm-model-codename>
SERVER_API_KEY=<your-server-secure-api-key>
```

---

## 💻 Usage & Automation

### 1. Manual Execution
Run the CLI manually inside any git repository to scan your current staged changes:
```bash
local-pr-review
```

### 2. Set Up Automated Pre-Commit Hook (Husky)
To enforce automated code reviews and security scans on every git commit, configure Husky in your target project repository:

1. **Initialize Husky:**
   ```bash
   npx husky init
   ```

2. **Configure the Hook:**
   Open `.husky/pre-commit` and ensure it executes your command:
   ```bash
   #!/usr/bin/env sh
   . "$(dirname -- "$0")/_/husky.sh"

   local-pr-review
   ```

When you attempt to commit code, the tool renders its branded header, scans your staged diff locally, attributes findings to exact files, and safely blocks the commit if any high or medium-risk issues are detected!

---

## 📂 Project Structure

```text
.
├── src/
│   ├── index.ts                       # CLI entry point, branded header, spinner, and terminal UI
│   ├── createPrettifiedResult.ts      # helper function
│   ├── findMissingTestFiles.ts        # helper function
│   ├── git.ts                         # Git wrapper capturing staged diffs and modified file lists
│   └── reviewer.ts                    # Core engine: pre-flight health check, prompt engineering, Zod validation
├── tests/
│   ├── fixtures/                      # dummy data for test cases
│   ├── eval.test.ts                   # test function
├── package.json                       # Dependencies, build scripts, and bin configuration
├── tsconfig.json                      # TypeScript NodeNext ESM compiler configurations
└── README.md                          # Project documentation
└── architecture.md                    # Project architecture
```

---

## 📜 License

This project is open-source under the **GNU GPL-3.0-or-later** license.