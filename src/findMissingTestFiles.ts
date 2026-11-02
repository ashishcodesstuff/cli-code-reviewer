import path from 'path';
import fs from 'fs';

// can be extended for extended support
const VALID_SOURCE_EXTENSIONS = new Set([
    '.ts', 
    '.tsx', 
    '.js', 
    '.jsx', 
    '.py', 
    '.go', 
    '.rs', 
    '.java'
]);

export function findMissingTestFiles(changedFiles: string[]): string[] {
  return changedFiles.filter(file => {
    const ext = path.extname(file).toLowerCase();

    // 1. Ignore if it's not a valid source file extension (e.g. .md, .txt, .json, .yml)
    if (!VALID_SOURCE_EXTENSIONS.has(ext)) {
      return false;
    }

    // 2. Ignore if the file itself is already a test file
    if (file.includes('.test.') || file.includes('.spec.') || file.includes('test/') || file.includes('tests/')) {
      return false;
    }

    const baseName = file.slice(0, -ext.length);
    
    // Check common test file conventions
    // can be extended later
    const testPath1 = `${baseName}.test${ext}`;
    const testPath2 = `${baseName}.spec${ext}`;
    
    const hasTest = fs.existsSync(testPath1) || fs.existsSync(testPath2);
    return !hasTest;
  });
}