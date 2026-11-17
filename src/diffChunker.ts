export function splitDiffIntoChunks(rawDiff: string): string[] {
    if (!rawDiff.trim()) return [];

    const fileDiffs = rawDiff.split(/(?=diff --git )/g);

    return fileDiffs.filter(chunk => chunk.trim().length > 0);
}