#!/usr/bin/env node

import { getLocalDiff } from "./git.js";
import { reviewCodeDiff } from "./reviewer.js";
import kleur from "kleur";
import ora from 'ora';
import { createPrettifiedResult } from "./createPrettifiedResult.js";
import dotenv from 'dotenv';

dotenv.config();

function printHeader() {
    console.log(kleur.cyan().bold('\n============================================================'));
    // Background highlight makes the title command-line prominent and bold
    console.log(kleur.bgCyan().black().bold('             🛡️   LOCAL AI PR REVIEWER   🛡️              '));
    console.log(kleur.cyan().bold('============================================================'));
    console.log(kleur.gray('        Privacy-First Git Security & Quality Guard          '));
    console.log(kleur.cyan().bold('------------------------------------------------------------\n'));
}

async function main() {
    printHeader();

    const spinner = ora('🤖 Scanning local git changes...').start();

    const { diff, changedFiles } = getLocalDiff();

    if (!diff) {
        spinner.succeed(kleur.green('🌳 Working tree is clean. No code changes to review.'));
        process.exitCode = 0;
        return;
    }

    spinner.text = '🤖 Sending diff to the Local LLM for security and quality review...';

    try {
        const reviewResult = await reviewCodeDiff(diff, changedFiles);
        spinner.stop();

        const framedOutput = createPrettifiedResult(reviewResult);
        console.log(framedOutput);

        if (reviewResult.riskLevel === "HIGH" || reviewResult.riskLevel === "MEDIUM") {
            console.error(kleur.red('\n❌ Commit blocked due to HIGH/MEDIUM risk findings.\n'));
            process.stdout.write('', () => {
                process.exit(1);
            });
            return;
        }

        process.exitCode = 0;
    } catch (error: any) {
        spinner.stop();
        console.error(kleur.red('Review failed: ' + error.message));
        process.stdout.write('', () => {
            process.exit(1);
        });
    }
}

main();