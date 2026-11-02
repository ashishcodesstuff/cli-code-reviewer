import { execSync } from "child_process";

function getLocalDiff(targetBranch = "HEAD~1"): string {
    try {
        const diff = execSync(`git diff ${targetBranch}`, { encoding: "utf-8" });

        if (!diff.trim()) {
            return "No changes found in the specified git range";
        }

        return diff;
    } catch (error) {
        console.log("Failed to execute git diff. Ensure that you are inside a git repository.", error);
        process.exit(1);
    }
}

export {
    getLocalDiff,
};