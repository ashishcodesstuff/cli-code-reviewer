import { describe, it } from "node:test";
import assert from "node:assert";
import { countAnchored, oldSideOfDiff, summarize, wilson } from "./score.js";
import type { EvalCase, RunRecord } from "./score.js";

const sampleDiff = [
    "diff --git a/src/a.ts b/src/a.ts",
    "--- a/src/a.ts",
    "+++ b/src/a.ts",
    "@@ -1,3 +1,3 @@",
    " keep();",
    "-const key = \"old\";",
    "-- a removed sql comment",
    "+const key = process.env.KEY;",
    "",
].join("\n");

const cases: EvalCase[] = [
    { id: "bad", diff: "x", changedFiles: ["a.ts"], category: "t", expectBlock: true, split: "dev" },
    { id: "good", diff: "y", changedFiles: ["b.ts"], category: "t", expectBlock: false, split: "dev" },
];

function rec(caseId: string, run: number, ok: boolean, risk?: "LOW" | "MEDIUM" | "HIGH"): RunRecord {
    return {
        caseId, run, ok, riskLevel: risk,
        predictedBlock: risk ? risk !== "LOW" : undefined,
        vulnerabilities: 0, remediations: 0, remediationsAnchored: 0,
        promptTokens: 100, completionTokens: 50, durationMs: 1000,
    };
}

describe("eval scoring helpers (no model needed)", () => {
    it("wilson interval is wide for small samples and handles n = 0", () => {
        assert.deepStrictEqual(wilson(0, 0), [0, 1]);
        const [lo, hi] = wilson(10, 10);
        assert.ok(lo > 0.7 && lo < 0.75, `lower bound was ${lo}`);
        assert.ok(hi > 0.99);
    });

    it("oldSideOfDiff keeps context and removed lines, drops headers and added lines", () => {
        const old = oldSideOfDiff(sampleDiff);
        assert.ok(old.includes("keep();"));
        assert.ok(old.includes("const key = \"old\";"));
        assert.ok(old.includes("- a removed sql comment"), "a removed line that starts with -- must survive");
        assert.ok(!old.includes("process.env.KEY"));
        assert.ok(!old.includes("a/src/a.ts"));
    });

    it("countAnchored counts only snippets present on the old side", () => {
        const n = countAnchored(sampleDiff, [
            { originalCode: "const key = \"old\";" },
            { originalCode: "something the model invented" },
            { originalCode: "" },
        ]);
        assert.strictEqual(n, 1);
    });

    it("summarize computes catch rate, false-positive rate, failures, and stability", () => {
        const records: RunRecord[] = [
            rec("bad", 1, true, "HIGH"),
            rec("bad", 2, true, "LOW"),
            rec("bad", 3, false),
            rec("good", 1, true, "LOW"),
            rec("good", 2, true, "LOW"),
            rec("good", 3, true, "MEDIUM"),
        ];
        const s = summarize(cases, records);

        assert.strictEqual(s.totalRuns, 6);
        assert.strictEqual(s.failedRuns, 1);
        assert.strictEqual(s.positiveRuns, 2);   // the failed run is excluded
        assert.strictEqual(s.caught, 1);
        assert.strictEqual(s.recall, 0.5);
        assert.strictEqual(s.negativeRuns, 3);
        assert.strictEqual(s.falseAlarms, 1);
        assert.ok(Math.abs((s.falsePositiveRate as number) - 1 / 3) < 1e-9);
        // bad: 1 of 2 blocked -> agreement 0.5; good: 1 of 3 blocked -> agreement 2/3
        assert.ok(Math.abs((s.stability as number) - (0.5 + 2 / 3) / 2) < 1e-9);
        assert.strictEqual(s.avgTotalTokens, 150);
    });
});
