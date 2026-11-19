// Pure scoring helpers for the eval runner. No model calls, no config loading,
// so everything here can be unit-tested without a server or a .env file.

export type Risk = "LOW" | "MEDIUM" | "HIGH";

export interface EvalCase {
    id: string;
    diff: string; // path to the .diff file, relative to tests/evals
    changedFiles: string[];
    category: string;
    /** Ground truth: would a reasonable reviewer want this commit stopped? */
    expectBlock: boolean;
    /** "dev" cases are for tuning prompts; "holdout" cases are only for final checks. */
    split: "dev" | "holdout";
    pairWith?: string;
    notes?: string;
}

export interface RunRecord {
    caseId: string;
    run: number;
    ok: boolean;
    error?: string;
    riskLevel?: Risk;
    predictedBlock?: boolean;
    vulnerabilities: number;
    remediations: number;
    remediationsAnchored: number;
    promptTokens: number;
    completionTokens: number;
    durationMs: number;
}

/** The tool blocks a commit on MEDIUM or HIGH, so the eval uses the same rule. */
export function blocks(risk: Risk): boolean {
    return risk === "MEDIUM" || risk === "HIGH";
}

/** Context and removed lines of a unified diff, with the +/-/space prefix stripped. */
export function oldSideOfDiff(diff: string): string {
    return diff
        .split("\n")
        .filter((line) =>
            (line.startsWith(" ") || line.startsWith("-")) &&
            !/^--- (a\/|\/dev\/null)/.test(line)
        )
        .map((line) => line.slice(1))
        .join("\n");
}

/**
 * How many remediations quote text that really exists on the old side of the diff.
 * This is a rough stand-in for "could the auto-patch find this snippet". The real
 * patcher checks the whole file, so a miss here is a warning, not proof of failure.
 */
export function countAnchored(diff: string, remediations: { originalCode: string }[]): number {
    const oldSide = oldSideOfDiff(diff);
    return remediations.filter((r) => r.originalCode.length > 0 && oldSide.includes(r.originalCode)).length;
}

/** 95% Wilson score interval for k successes out of n. Honest about small samples. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
    if (n === 0) return [0, 1];
    const p = k / n;
    const denom = 1 + (z * z) / n;
    const centre = (p + (z * z) / (2 * n)) / denom;
    const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
    return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

export interface CaseSummary {
    id: string;
    expectBlock: boolean;
    valid: number;
    failed: number;
    blocked: number;
    risks: Record<string, number>;
    /** Share of valid runs that agree with the majority decision (1 = fully stable). */
    agreement: number | null;
}

export interface Summary {
    totalRuns: number;
    failedRuns: number;
    failureRate: number;
    positiveRuns: number;
    caught: number;
    recall: number | null;
    recallCI: [number, number];
    negativeRuns: number;
    falseAlarms: number;
    falsePositiveRate: number | null;
    falsePositiveCI: [number, number];
    stability: number | null;
    remediations: number;
    remediationsAnchored: number;
    anchorRate: number | null;
    avgTotalTokens: number;
    avgDurationMs: number;
    perCase: CaseSummary[];
}

const ratio = (a: number, b: number): number | null => (b === 0 ? null : a / b);

/** Rates are computed over valid runs only; failed runs are reported separately. */
export function summarize(cases: EvalCase[], records: RunRecord[]): Summary {
    const byId = new Map(cases.map((c) => [c.id, c]));
    const valid = records.filter((r) => r.ok);

    let positiveRuns = 0, caught = 0, negativeRuns = 0, falseAlarms = 0;
    for (const r of valid) {
        const c = byId.get(r.caseId);
        if (!c) continue;
        if (c.expectBlock) {
            positiveRuns++;
            if (r.predictedBlock) caught++;
        } else {
            negativeRuns++;
            if (r.predictedBlock) falseAlarms++;
        }
    }

    const perCase: CaseSummary[] = cases.map((c) => {
        const runs = records.filter((r) => r.caseId === c.id);
        const ok = runs.filter((r) => r.ok);
        const blocked = ok.filter((r) => r.predictedBlock).length;
        const risks: Record<string, number> = {};
        for (const r of ok) risks[r.riskLevel as string] = (risks[r.riskLevel as string] ?? 0) + 1;
        return {
            id: c.id,
            expectBlock: c.expectBlock,
            valid: ok.length,
            failed: runs.length - ok.length,
            blocked,
            risks,
            agreement: ok.length === 0 ? null : Math.max(blocked, ok.length - blocked) / ok.length,
        };
    });

    const agreements = perCase.map((c) => c.agreement).filter((a): a is number => a !== null);
    const remediations = valid.reduce((s, r) => s + r.remediations, 0);
    const remediationsAnchored = valid.reduce((s, r) => s + r.remediationsAnchored, 0);

    return {
        totalRuns: records.length,
        failedRuns: records.length - valid.length,
        failureRate: records.length === 0 ? 0 : (records.length - valid.length) / records.length,
        positiveRuns,
        caught,
        recall: ratio(caught, positiveRuns),
        recallCI: wilson(caught, positiveRuns),
        negativeRuns,
        falseAlarms,
        falsePositiveRate: ratio(falseAlarms, negativeRuns),
        falsePositiveCI: wilson(falseAlarms, negativeRuns),
        stability: agreements.length === 0 ? null : agreements.reduce((a, b) => a + b, 0) / agreements.length,
        remediations,
        remediationsAnchored,
        anchorRate: ratio(remediationsAnchored, remediations),
        avgTotalTokens: valid.length === 0 ? 0 : valid.reduce((s, r) => s + r.promptTokens + r.completionTokens, 0) / valid.length,
        avgDurationMs: valid.length === 0 ? 0 : valid.reduce((s, r) => s + r.durationMs, 0) / valid.length,
        perCase,
    };
}

const pct = (x: number | null): string => (x === null ? "n/a" : `${(x * 100).toFixed(0)}%`);
const ci = (x: [number, number]): string => `${(x[0] * 100).toFixed(0)}-${(x[1] * 100).toFixed(0)}%`;

export function formatSummary(s: Summary): string {
    const lines: string[] = [];
    lines.push("Per case (blocked = MEDIUM or HIGH):");
    for (const c of s.perCase) {
        const risks = Object.entries(c.risks).map(([k, v]) => `${k}x${v}`).join(" ") || "-";
        const verdict =
            c.valid === 0 ? "NO VALID RUNS"
            : c.expectBlock ? (c.blocked === c.valid ? "ok" : "MISSED")
            : (c.blocked === 0 ? "ok" : "FALSE ALARM");
        lines.push(
            `  ${c.id.padEnd(28)} expect ${c.expectBlock ? "block   " : "no block"}  ` +
            `blocked ${c.blocked}/${c.valid}  failed ${c.failed}  [${risks}]  ${verdict}`
        );
    }
    lines.push("");
    lines.push("Overall (rates use valid runs only; failures are counted separately):");
    lines.push(`  Failed runs        ${s.failedRuns}/${s.totalRuns} (${pct(s.failureRate)})`);
    lines.push(`  Catch rate         ${s.caught}/${s.positiveRuns} (${pct(s.recall)}, 95% CI ${ci(s.recallCI)})`);
    lines.push(`  False-positive     ${s.falseAlarms}/${s.negativeRuns} (${pct(s.falsePositiveRate)}, 95% CI ${ci(s.falsePositiveCI)})`);
    lines.push(`  Stability          ${pct(s.stability)} (share of runs agreeing with each case's majority)`);
    lines.push(`  Remediation anchor ${s.remediationsAnchored}/${s.remediations} (${pct(s.anchorRate)}) quote text found in the diff`);
    lines.push(`  Avg tokens/run     ${s.avgTotalTokens.toFixed(0)}`);
    lines.push(`  Avg latency/run    ${s.avgDurationMs.toFixed(0)} ms`);
    return lines.join("\n");
}
