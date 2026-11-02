# 🛡️ Local AI PR Reviewer

A lightning-fast, privacy-first CLI tool that performs automated code reviews, security scans, and test coverage checks locally on your machine using any OpenAI-compatible LLM endpoint (such as LM Studio, Ollama, or vLLM). 

Designed for developers who want automated guardrails without leaking proprietary code to third-party cloud services.

---

## ✨ Features

* **100% Local & Privacy-First:** Runs entirely offline using your local LLM inference server.
* **Backend-Agnostic:** Built on standard OpenAI-compatible APIs, allowing you to easily swap out models and local runtimes via environment variables.
* **Hybrid Guardrail Pattern:** Combines deterministic Node.js file system checks (for file paths, whitelisted source extensions, and test existence) with probabilistic AI analysis for deep semantic and security reviews.
* **Strict Security Guardrails:** Instantly flags hardcoded API keys, sensitive credentials, and common vulnerabilities.
* **Robust JSON Enforcement:** Combines advanced regex sanitization with **Zod** schema validation to eliminate LLM parsing errors.
* **Modern Terminal UI:** Built with `boxen`, `kleur`, and `ora` for a clean, color-coded, professional developer experience.

---

## 🛠️ Tech Stack

* **Language:** TypeScript (Node.js ESM)
* **Validation:** Zod
* **AI Integration:** OpenAI SDK configured for local endpoints
* **Terminal UI:** Boxen, Kleur, Ora

---

## 🚀 Getting Started

### Prerequisites

1. **Node.js** (v18+ recommended)
2. A local LLM server running an OpenAI-compatible API (e.g., LM Studio, Ollama, vLLM, or LocalAI) with an open-weight code model loaded.

### Installation

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Build the TypeScript project:
   ```bash
   npm run build
   ```

---

## ⚙️ Configuration

Create a `.env` file in the root directory of your project to configure your local model and endpoint:

```env
REVIEWER_MODEL="your-model-name"
SERVER_URL="your-server-url"
SERVER_API_KEY="your-api-key-or-placeholder"
```

> **Note on Testing Environment:** While you are free to use any local server or provider (such as Ollama or vLLM), this utility was developed and tested locally using open-weight code models.

---

## 💻 Usage

### 1. Start Your Local LLM Server
Ensure your local server is running and your preferred model is loaded into memory at the configured `SERVER_URL`.

### 2. Run the Reviewer
Make some code modifications in your git repository, then run the development script:
```bash
npm run dev
```

Or, if installed/linked locally:
```bash
local-pr-review
```

---

## 📂 Project Structure

```text
.
├── src/
│   ├── index.ts      # CLI entry point, spinner, and terminal UI rendering (boxen/kleur)
│   ├── git.ts        # Git wrapper capturing diffs and modified file lists
│   └── reviewer.ts   # Core engine: pre-flight health check, prompt engineering, Zod validation
├── package.json      # Dependencies, build scripts, and bin configuration
├── tsconfig.json     # TypeScript NodeNext ESM compiler configurations
└── README.md         # Project documentation
```

---

## 📜 License

This project is open-source under the **GNU GPL-3.0-or-later** license.