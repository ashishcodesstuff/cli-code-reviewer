import { describe, it } from "node:test";
import assert from "node:assert";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { reviewCodeDiff } from "../src/reviewer.js";
import { FullReviewResponse } from "../src/reviewer.js";
import { splitDiffIntoChunks } from "../src/diffChunker.js";
import { processAndMergeChunks } from "../src/processAndMergeChunks.js";

describe('Local PR Reviewer AI evaluations', () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const fixturesDir = path.join(__dirname, 'fixtures');

    it('Evaluates hardcoded secret diff correctly as HIGH risk', { timeout: 30000 }, async () => {
        const diffPath = path.join(fixturesDir, 'hardcoded-secret.diff');
        const diffContent = fs.readFileSync(diffPath, "utf-8");

        const changedFiles = ['src/auth.ts'];

        const result = await reviewCodeDiff(diffContent, changedFiles);

        assert.strictEqual(result.result.riskLevel, 'HIGH', 'Risk level should be flagged as HIGH');
        assert.ok(
            result.result.securityVulnerabilities.length > 0,
            'Should detect at least one security vulnerability'
        );
    });

    it('Evaluate clean refactor diff correctly as LOW risk', { timeout: 30000 }, async () => {
        const diffPath = path.join(fixturesDir, 'clean-refactor.diff');
        const diffContent = fs.readFileSync(diffPath, "utf-8");

        const changedFiles = ['src/math.ts'];

        const result = await reviewCodeDiff(diffContent, changedFiles);

        assert.ok(result);
        assert.strictEqual(result.result.riskLevel, 'LOW', 'Risk level should be flagged as LOW');
        assert.strictEqual(result.result.securityVulnerabilities.length, 0);
    });

    it('Detects missing test files correctly', { timeout: 30000 }, async () => {
        const diffPath = path.join(fixturesDir, 'missing-tests.diff');
        const diffContent = fs.readFileSync(diffPath, "utf-8");

        // Pass a source file that has no matching test file in the list
        const changedFiles = ['src/service.ts'];

        const result = await reviewCodeDiff(diffContent, changedFiles);

        assert.ok(result);
        const missingTests = result.result.missingTestFiles ?? [];
        assert.ok(
            missingTests.includes('src/service.ts'),
            'Should flag src/service.ts as missing a corresponding test file'
        );
    });

    it('Detects and generates remediations for fixable code', { timeout: 30000 }, async () => {
        const diffPath = path.join(fixturesDir, 'remediation-fix.diff'); // or your target fixture file
        const diffContent = fs.readFileSync(diffPath, "utf-8");

        const changedFiles = ['src/utils.ts'];

        const result = await reviewCodeDiff(diffContent, changedFiles);

        assert.ok(result);
        assert.ok(
            Array.isArray(result.result.remediations),
            'Result should contain a remediations array'
        );
        assert.ok(
            result.result.remediations.length > 0,
            'Should suggest at least one code remediation'
        );

        // Verify the shape of the remediation object
        if (result.result.remediations && result.result.remediations.length > 0) {
            const firstRemediation = result.result.remediations[0];
            assert.ok(firstRemediation.filePath, 'Remediation must specify a file path');
            assert.ok(firstRemediation.originalCode, 'Remediation must specify original code to replace');
            assert.ok(firstRemediation.suggestedEdit, 'Remediation must specify suggested replacement code');
        }
    });

    it('should correctly split a multi-file diff loaded from .diff fixture file', () => {
        const diffPath = path.join(fixturesDir, 'multi-file-diff.diff'); // or your target fixture file
        const diffContent = fs.readFileSync(diffPath, "utf-8");

        const chunks = splitDiffIntoChunks(diffContent);

        assert.strictEqual(chunks.length, 2, 'Should split into exactly 2 file chunks');
    });

    it('should return empty array for empty diff strings', () => {
        const chunks = splitDiffIntoChunks('   \n');
        assert.deepStrictEqual(chunks, [], 'Should return an empty array');
    });

    it('should correctly accumulate tokens, duration, and escalate risk level', () => {
        const response1: FullReviewResponse = {
            result: {
                riskLevel: 'LOW',
                securityVulnerabilities: ['[src/auth.ts]: Minor warning'],
                suggestedRefactors: ['Use const'],
                missingTestFiles: ['src/auth.ts'],
                remediations: [],
            },
            metrics: { promptTokens: 100, completionTokens: 50, totalTokens: 150, durationMs: 200 }
        };

        const response2: FullReviewResponse = {
            result: {
                riskLevel: 'HIGH',
                securityVulnerabilities: ['[src/index.ts]: Hardcoded secret'],
                suggestedRefactors: ['Use const', 'Extract config'],
                missingTestFiles: ['src/index.ts', 'src/auth.ts'],
                remediations: [],
            },
            metrics: { promptTokens: 200, completionTokens: 100, totalTokens: 300, durationMs: 400 }
        };

        const merged = processAndMergeChunks([response1, response2]);

        assert.strictEqual(merged.result.riskLevel, 'HIGH', 'Risk level should escalate to HIGH');
        assert.strictEqual(merged.metrics.totalTokens, 450, 'Total tokens should be summed correctly');
        assert.strictEqual(merged.metrics.durationMs, 600, 'Duration should be summed correctly');
        assert.deepStrictEqual(merged.result.suggestedRefactors, ['Use const', 'Extract config']);
        assert.deepStrictEqual(merged.result.missingTestFiles, ['src/auth.ts', 'src/index.ts']);
    });
});