import { execSync } from "child_process";
import path from "path";

export interface GitChanges {
    diff: string,
    changedFiles: string[],
};

// Extensions that are never code and should never be sent to an LLM
const BLACKLISTED_EXTENSIONS = new Set([
  // Images & Media
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.mp4', '.mov', '.mp3',
  // Documents & Archives
  '.pdf', '.doc', '.docx', '.zip', '.tar', '.gz', '.rar', '.7z',
  // Binaries & Compiled Output
  '.exe', '.dll', '.so', '.dmg', '.pkg', '.ico', '.class', '.pyc'
]);

function getFilteredChangedFiles(files: string[]): string[] {
  if (files.length === 0) return [];

  const codeFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    return !BLACKLISTED_EXTENSIONS.has(ext);
  });

  if (codeFiles.length === 0) return [];

  try {
    const ignoredOutput = execSync(`git check-ignore ${codeFiles.join(' ')}`, { encoding: 'utf-8' });
    console.log(ignoredOutput)
    const ignoredFiles = new Set(
      ignoredOutput.split('\n').map(f => f.trim()).filter(Boolean)
    );

    return codeFiles.filter(file => !ignoredFiles.has(file));
  } catch (err) {
    console.log(err)
    return codeFiles;
  }
}

function getLocalDiff(targetBranch = "HEAD~1"): GitChanges {
    try {
        const diff = execSync(`git diff ${targetBranch}`, { encoding: "utf-8" });
        const filesOutput = execSync(`git diff --name-only ${targetBranch}`, {encoding: "utf-8"});

        const changedFiles = filesOutput ? filesOutput.split('\n').filter(Boolean) : [];
        const filteredFiles = getFilteredChangedFiles(changedFiles);
        console.log(filteredFiles)

        return {diff, changedFiles: filteredFiles};
    } catch (error) {
        console.log("Failed to execute git diff. Ensure that you are inside a git repository.", error);
        process.exit(1);
    }
}

export {
    getLocalDiff,
    getFilteredChangedFiles,
};