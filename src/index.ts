#!/usr/bin/env node

import { getLocalDiff } from "./git.js";
import { reviewCodeDiff } from "./reviewer.js";
import kleur from "kleur";
import ora from 'ora';
import { createPrettifiedResult } from "./createPrettifiedResult.js";
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const spinner = ora('🤖 Scanning local git changes...').start();


    const {diff, changedFiles} = getLocalDiff('main');

    if (!diff) {
        spinner.succeed(kleur.green('🌳 Working tree is clean. No code changes to review.'));
        process.exit(0);
    }

    spinner.text = '🤖 Sending diff to the Local LLM for security and quality review...';

    try {
        const reviewResult = await reviewCodeDiff(diff, changedFiles);
        spinner.stop();

        const framedOutput = createPrettifiedResult(reviewResult);
        console.log(framedOutput);
    } catch (error: any) {
        spinner.fail(kleur.red('Review failed.'));
        console.error(kleur.red(error.message));
        process.exit(1);
    }
}

main();