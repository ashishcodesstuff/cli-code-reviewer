import { describe, it } from "node:test";
import assert from "node:assert";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { reviewCodeDiff } from "../src/reviewer.js";

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
});