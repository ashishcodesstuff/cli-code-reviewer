// Eval runner: runs every labeled case several times against the configured model
// and reports rates instead of pass/fail.
//
//   npm run eval:run                      all cases, 3 runs each
//   npm run eval:run -- --runs 5          5 runs each
//   npm run eval:run -- --split dev       only the dev split (use holdout sparingly)
//   npm run eval:run -- --filter sqli     only cases whose id contains "sqli"
//
// Uses the same .env / environment variables as the CLI (REVIEWER_MODEL, SERVER_URL,
// SERVER_API_KEY). Run it from the repository root.

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { reviewCodeDiff } from "../../src/reviewer.js";
import { blocks, countAnchored, formatSummary, summarize } from "./score.js";
import type { EvalCase, RunRecord } from "./score.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

function arg(name: string, fallback: string): string {
    const i = process.argv.indexOf(`--${name}`);
    return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function gitInfo(): { commit: string; dirty: boolean } {
    try {
        const run = (cmd: string) =>
            execSync(cmd, { cwd: repoRoot, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
        return { commit: run("git rev-parse --short HEAD"), dirty: run("git status --porcelain").length > 0 };
    } catch {
        return { commit: "unknown", dirty: false };
    }
}

async function main() {
    const runsPerCase = Number(arg("runs", "3"));
    const split = arg("split", "all");
    const filter = arg("filter", "");

    if (!Number.isInteger(runsPerCase) || runsPerCase < 1) throw new Error("--runs must be a positive integer");
    if (!["all", "dev", "holdout"].includes(split)) throw new Error("--split must be all, dev, or holdout");

    const allCases: EvalCase[] = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf-8"));
    const cases = allCases.filter(
        (c) => (split === "all" || c.split === split) && c.id.includes(filter)
    );
    if (cases.length === 0) throw new Error("No cases match those options");

    const model = process.env.REVIEWER_MODEL ?? "unknown";
    console.error(`Running ${cases.length} cases x ${runsPerCase} runs on model "${model}"`);

    const startedAt = new Date().toISOString();
    const records: RunRecord[] = [];

    for (const c of cases) {
        const diff = fs.readFileSync(path.join(__dirname, c.diff), "utf-8");
        for (let run = 1; run <= runsPerCase; run++) {
            process.stderr.write(`  ${c.id} run ${run}/${runsPerCase} ... `);
            try {
                const res = await reviewCodeDiff(diff, c.changedFiles);
                const remediations = res.result.remediations ?? [];
                records.push({
                    caseId: c.id,
                    run,
                    ok: true,
                    riskLevel: res.result.riskLevel,
                    predictedBlock: blocks(res.result.riskLevel),
                    vulnerabilities: res.result.securityVulnerabilities.length,
                    remediations: remediations.length,
                    remediationsAnchored: countAnchored(diff, remediations),
                    promptTokens: res.metrics.promptTokens,
                    completionTokens: res.metrics.completionTokens,
                    durationMs: res.metrics.durationMs,
                });
                process.stderr.write(`${res.result.riskLevel}\n`);
            } catch (error: any) {
                records.push({
                    caseId: c.id,
                    run,
                    ok: false,
                    error: String(error).slice(0, 500),
                    vulnerabilities: 0,
                    remediations: 0,
                    remediationsAnchored: 0,
                    promptTokens: 0,
                    completionTokens: 0,
                    durationMs: 0,
                });
                process.stderr.write("FAILED\n");
            }
        }
    }

    const summary = summarize(cases, records);
    console.log("\n" + formatSummary(summary));

    const { commit, dirty } = gitInfo();
    const meta = {
        model,
        serverHost: process.env.SERVER_URL ? new URL(process.env.SERVER_URL).host : "default (OpenAI API)",
        runsPerCase,
        split,
        filter,
        caseCount: cases.length,
        commit,
        dirtyWorkingTree: dirty,
        startedAt,
    };

    const outDir = path.join(__dirname, "results");
    fs.mkdirSync(outDir, { recursive: true });
    const safeModel = model.replace(/[^a-zA-Z0-9._-]/g, "_");
    const file = path.join(outDir, `${startedAt.replace(/[:.]/g, "-")}_${safeModel}.json`);
    fs.writeFileSync(file, JSON.stringify({ meta, summary, records }, null, 2));
    console.log(`\nSaved ${path.relative(repoRoot, file)}${dirty ? "  (note: working tree had uncommitted changes)" : ""}`);
}

main().catch((error) => {
    console.error(String(error));
    process.exit(1);
});
