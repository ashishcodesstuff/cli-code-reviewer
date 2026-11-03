import { z } from "zod";
import OpenAI from "openai";
import dotenv from 'dotenv';
import { findMissingTestFiles } from "./findMissingTestFiles.js";

dotenv.config()

const ReviewSchema = z.object({
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    securityVulnerabilities: z.array(z.string()),
    suggestedRefactors: z.array(z.string()),
    missingTestFiles: z.array(z.string()),
});

export interface ReviewMetrics {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    durationMs: number;
};

export interface FullReviewResponse {
    result: z.infer<typeof ReviewSchema>,
    metrics: ReviewMetrics,
};

const client = new OpenAI({
    baseURL: process.env.SERVER_URL,
    apiKey: process.env.SERVER_API_KEY,
});

async function reviewCodeDiff(diff: string, changedFiles: string[]): Promise<FullReviewResponse> {
    const startTime = performance.now();

    // PREFLIGHT CHECK FOR LOADED MODEL 
    try {
        const modelsResponse = await client.models.list();
        if (!modelsResponse.data || !modelsResponse.data.length) {
            "LM Studio server is running, but no model is loaded into memory.\n" +
                "👉 Run 'lms load <model name> -y' in your terminal to load a model."
        }
    } catch (error: any) {
        if (error.message.includes("no model is loaded")) {
            throw error;
        }

        throw new Error(
            "Could not connect to local model server. Make sure it is running"
        )
    }

    const missingTestFiles = findMissingTestFiles(changedFiles);

    const systemPrompt = `
You are an expert senior software engineer and security auditor.
        Analyze the provided git diff for security vulnerabilities, architectural flaws, and test coverage.

        CRITICAL INSTRUCTIONS FOR DIFF ANALYSIS:
        1. Pay attention to git diff prefixes:
        - Lines starting with '+' are NEW additions. Focus your review and risk assessment primarily on these.
        - Lines starting with '-' are REMOVED code (deletions / cleanups). 
        2. If a sensitive pattern (like a password, API key, or hardcoded secret) appears on a REMOVED line ('-'), it means the developer is actively CLEANING IT UP or FIXING IT. Do NOT flag removed security issues as risks.
        3. Only flag security vulnerabilities if they are introduced or present in the active code.
        4. Look out for OWASP Top 10 risks (e.g., SQL injection, XSS, insecure deserialization).

        FILE ATTRIBUTION RULE:
        - Every entry in "securityVulnerabilities" MUST explicitly state the file path where the issue was found using the format: "[path/to/file.ts]: Description of the vulnerability."

        TEST COVERAGE RULES:
        - The list of modified files in this PR is: ${JSON.stringify(changedFiles)}
        - Look at each file in the modified list. If its matching test file (e.g., file.test.ts or file.spec.ts) is NOT present in the modified list or project, you MUST list that file path in the "missingTestFiles" array.

        You MUST output valid raw JSON only, adhering strictly to this schema:
        {
        "riskLevel": "LOW" | "MEDIUM" | "HIGH",
        "securityVulnerabilities": ["[src/auth.ts]: Hardcoded JWT secret found on line 14"],
        "suggestedRefactors": ["List of code improvements"],
        "missingTestFiles": ["src/example.ts"]
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

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    const rawText = response.choices[0].message.content || '';
    const cleanedText = rawText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .replace(/[\u00A0\u200B]/g, ' ')
        .trim();

    const jsonStartIndex = cleanedText.indexOf('{');
    const jsonEndIndex = cleanedText.indexOf('}');

    if (jsonStartIndex === -1 || jsonEndIndex === 1) {
        throw new Error(`No valid JSON object found in LLM response:\n${rawText}`);
    }

    const jsonString = cleanedText.substring(jsonStartIndex, jsonEndIndex + 1);

    try {
        const parsedJson = JSON.parse(jsonString);
        const validationResult = ReviewSchema.safeParse(parsedJson);

        if (!validationResult.success) {
            throw new Error(`Schema validation failed: ${JSON.stringify(validationResult.error.format())}`);
        }

        return {
            result: {
                ...validationResult.data,
                missingTestFiles,
            },
            metrics: {
                promptTokens: response.usage?.prompt_tokens ?? 0,
                completionTokens: response.usage?.completion_tokens ?? 0,
                totalTokens: response.usage?.total_tokens ?? 0,
                durationMs,
            }
        };
    } catch (error) {
        throw new Error(`Failed to parse or validate LLM response as JSON. Raw output:\n${rawText}\n\nError: ${error}`);
    }
}

export {
    reviewCodeDiff,
};