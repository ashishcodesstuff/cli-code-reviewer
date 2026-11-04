import fs from 'node:fs/promises';
import prompt from 'enquirer'

async function promptUserForRemediation(
    remediations: Array<{ filePath: string, issue: string, originalCode: string, suggestedEdit: string }>
) {
    if (remediations.length === 0) return;

    console.log('\n🛠️  AI-Suggested Code Remediations Available:');
    remediations.forEach((rem, idx) => {
        console.log(`\n[${idx + 1}] File: ${rem.filePath}`);
        console.log(`    Issue: ${rem.issue}`);
        console.log(`    Fix: Replace \`${rem.originalCode.trim()}\` with \`${rem.suggestedEdit.trim()}\``);
    });

    try {
        const userResponse = await prompt.prompt<{ confirmation: string }>({
            type: 'input',
            name: 'confirmation',
            message: 'Would you like to auto apply these remediations to your workspace? (y/n):'
        });

        const answer = userResponse.confirmation.trim().toLocaleLowerCase();

        if (answer === "y") {
            for (const rem of remediations) {
                try {
                    const fileContent = await fs.readFile(rem.filePath, 'utf-8');
                    if (fileContent.includes(rem.originalCode)) {
                        const updatedContent = fileContent.replace(rem.originalCode, rem.suggestedEdit);
                        await fs.writeFile(rem.filePath, updatedContent, 'utf-8');
                        console.log(`✅ Applied fix to ${rem.filePath}`);
                    } else {
                        console.log(`⚠️ Could not automatically match snippet in ${rem.filePath}. Please fix manually.`);
                    }
                } catch (error) {
                    console.error(`❌ Error patching file ${rem.filePath}:`, error);
                }
            }
            console.log('\n💡 Remediations applied to working directory.');
            console.log('👉 Review changes using `git diff`, re-stage with `git add`, and try committing again.');
            // Aborting current commit so developer can review
            process.exit(1);
        } else {
            console.log('\n❌ Commit blocked. No files were modified.');
            process.exit(1);
        }
    } catch (error) {
        // Catches cancelations like Ctrl+C gracefully
        console.log('\n❌ Commit cancelled.');
        process.exit(1);
    }
}

export {
    promptUserForRemediation,
};