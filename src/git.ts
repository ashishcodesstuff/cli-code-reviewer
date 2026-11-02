import { execSync } from "child_process";

export interface GitChanges {
    diff: string,
    changedFiles: string[],
};

function getLocalDiff(targetBranch = "HEAD~1"): GitChanges {
    try {
        const diff = execSync(`git diff ${targetBranch}`, { encoding: "utf-8" });
        const filesOutput = execSync(`git diff --name-only ${targetBranch}`, {encoding: "utf-8"});

        const changedFiles = filesOutput ? filesOutput.split('\n').filter(Boolean) : [];

        return {diff, changedFiles};
    } catch (error) {
        console.log("Failed to execute git diff. Ensure that you are inside a git repository.", error);
        process.exit(1);
    }
}

export {
    getLocalDiff,
};