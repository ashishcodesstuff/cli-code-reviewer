import { FullReviewResponse } from "./reviewer.js";
import kleur from "kleur";
import boxen from "boxen";

function createPrettifiedResult(reviewResult: FullReviewResponse): string {
    let riskBadge = kleur.green().bold(' ✅ [LOW RISK] ');
    let borderColor: 'green' | 'yellow' | 'red' = 'green';

    if (reviewResult.result.riskLevel === 'MEDIUM') {
        riskBadge = kleur.yellow().bold(' ⚠️  [MEDIUM RISK] ');
        borderColor = 'yellow';
    } else if (reviewResult.result.riskLevel === 'HIGH') {
        riskBadge = kleur.red().bold(' 🚨 [HIGH RISK] ');
        borderColor = 'red';
    }

    const content: string[] = [];

    content.push(kleur.bold().underline('🛡️  PR SECURITY & QUALITY REPORT'));
    content.push(`Status Level:${riskBadge}\n`);

    content.push(kleur.bold('🔒 Security Vulnerabilities:'));
    if (reviewResult.result.securityVulnerabilities.length === 0) {
        content.push(kleur.green('  ✔ No vulnerabilities detected. Clean execution!'));
    } else {
        reviewResult.result.securityVulnerabilities.forEach((v, i) => {
            content.push(kleur.red(`  ${i + 1}. ✖ ${v}`));
        });
    }

    content.push(kleur.bold('\n💡 Suggested Refactors:'));
    if (reviewResult.result.suggestedRefactors.length === 0) {
        content.push(kleur.dim('  · None specified.'));
    } else {
        reviewResult.result.suggestedRefactors.forEach((r, i) => {
            content.push(kleur.cyan(`  ${i + 1}. ⚡ ${r}`));
        });
    }

    content.push(kleur.bold('\n🧪 Files Missing Test Coverage:'));
    if (reviewResult.result.missingTestFiles.length === 0) {
        content.push(kleur.green('  ✔ All modified source files have test coverage.'));
    } else {
        reviewResult.result.missingTestFiles.forEach((file, i) => {
            content.push(kleur.yellow(`  ${i + 1}. 📄 ${file}`));
        });
    }

    content.push(kleur.gray('┌────────────────────────────────────────────────────────┐'));
    content.push(kleur.cyan().bold('│ 📊 REVIEW METRICS & PERFORMANCE                        │'));
    content.push(kleur.gray('├────────────────────────────────────────────────────────┤'));
    content.push(`${kleur.blue('│')} Prompt Tokens:     ${kleur.yellow(reviewResult.metrics.promptTokens.toString().padEnd(35))} ${kleur.blue('│')}`);
    content.push(`${kleur.blue('│')} Completion Tokens: ${kleur.yellow(reviewResult.metrics.completionTokens.toString().padEnd(35))} ${kleur.blue('│')}`);
    content.push(`${kleur.blue('│')} Total Tokens:      ${kleur.green(reviewResult.metrics.totalTokens.toString().padEnd(35))} ${kleur.blue('│')}`);
    content.push(`${kleur.blue('│')} Execution Time:    ${kleur.magenta((reviewResult.metrics.durationMs / 1000).toFixed(2) + 's'.padEnd(34))} ${kleur.blue('│')}`);
    content.push(kleur.gray('└────────────────────────────────────────────────────────┘\n'));

    const framedOutput = boxen(content.join('\n'), {
        padding: { top: 1, bottom: 1, left: 2, right: 2 },
        margin: 1,
        borderStyle: 'double',
        borderColor: borderColor,
        width: 80,
    });
    
    return framedOutput;
}

export {
    createPrettifiedResult,
}