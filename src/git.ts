import { execSync } from 'child_process';
import path from 'path';

// Extensions and specific filenames that should never be sent to the LLM
const BLACKLISTED_EXTENSIONS = new Set([
    '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
    '.zip', '.tar', '.gz', '.exe', '.dll', '.bin', '.map', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.mov'
]);

const BLACKLISTED_FILES = new Set([
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    'composer.lock',
    'cargo.lock'
]);

export function getLocalDiff() {
    try {
        // 1. Get the list of staged files
        const filesOutput = execSync('git diff --cached --name-only', { encoding: 'utf-8' });
        const allStagedFiles = filesOutput.split('\n').map(f => f.trim()).filter(Boolean);

        if (allStagedFiles.length === 0) {
            return { diff: '', changedFiles: [] };
        }

        // 2. Filter out binaries, assets, and heavy lockfiles
        const validFiles = allStagedFiles.filter(file => {
            const ext = path.extname(file).toLowerCase();
            const basename = path.basename(file).toLowerCase();

            if (BLACKLISTED_EXTENSIONS.has(ext)) return false;
            if (BLACKLISTED_FILES.has(basename)) return false;
            
            return true;
        });

        if (validFiles.length === 0) {
            return { diff: '', changedFiles: [] };
        }

        // 3. Generate diff ONLY for the filtered, valid code files
        // We pass the explicit file paths to git diff --cached so it ignores everything else
        const fileArgs = validFiles.map(f => `"${f}"`).join(' ');
        const diff = execSync(`git diff --cached ${fileArgs}`, { encoding: 'utf-8' });

        return {
            diff,
            changedFiles: validFiles
        };
    } catch (error: any) {
        throw new Error(`Failed to retrieve git diff: ${error.message}`);
    }
}