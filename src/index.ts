#!/usr/bin/env node

import { getLocalDiff } from "./git.js";
import { reviewCodeDiff } from "./reviewer.js";

async function main() {
    const diff = getLocalDiff('HEAD~1');

    if(diff.includes("No changes found")) {
        console.log("Working tree is clean");
        process.exit(0);
    }

    console.log("SENDING DIFF TO Local LLM");

    try {
        const rawResult = await reviewCodeDiff(diff);
    }catch(error) {

    }
}

main();