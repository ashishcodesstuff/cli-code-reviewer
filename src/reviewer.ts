import {z} from "zod";
import OpenAI from "openai";

const ReviewSchema = z.object({
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    securityVulnaribilities: z.array(z.string()),
    suggestedRefactors: z.array(z.string()),
    missingTests: z.boolean(),
});

export type ReviewResult = z.infer<typeof ReviewSchema>;

const client = new OpenAI({
    baseURL: "http://localhost:1234/v1",
    apiKey: "lm-studio",
});

async function reviewCodeDiff(diff: string): Promise<void> {
    const systemPrompt = `
        You are an expert senior software engineer and security auditor.
        Analyze the provided git diff for security vulnerabilities (e.g., hardcoded secrets, injection risks), architectural flaws, and missing unit tests.
        You MUST output valid raw JSON only, adhering strictly to this schema:
        {
        "riskLevel": "LOW" | "MEDIUM" | "HIGH",
        "securityVulnerabilities": ["List of risks or empty array"],
        "suggestedRefactors": ["List of code improvements or empty array"],
        "missingTests": true or false
        }
        Do not wrap the JSON in markdown code blocks like \`\`\`json. Return only the raw JSON string.
    `;

    const response = await client.chat.completions.create({
        model: process.env.REVIEWER_MODEL as any,
        messages: [
            {
                role: "system",
                content: systemPrompt,
            },
            {
                role: "user",
                content: `Here is the git diff to review: \n\n ${diff}`,
            }
        ],
        temperature: 0.1,
    });

    const rawText = response.choices[0].message.content || '';
    console.log("RAW TEXT ", rawText);
}

export {
    reviewCodeDiff,
};