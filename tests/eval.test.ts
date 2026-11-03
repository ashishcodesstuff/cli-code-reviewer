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
        assert.ok(
            result.result.missingTestFiles.includes('src/service.ts'),
            'Should flag src/service.ts as missing a corresponding test file'
        );
    });
});