import { z } from "zod";
import OpenAI from "openai";
import { findMissingTestFiles } from "./findMissingTestFiles.js";
import { createPrompt } from "./createPrompt.js";
import dotenv from "dotenv";

dotenv.config();

const ReviewSchema = z.object({
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    securityVulnerabilities: z.array(z.string()),
    suggestedRefactors: z.array(z.string()),
    missingTestFiles: z.array(z.string()),
    remediations: z.array(
        z.object({
            filePath: z.string(),
            issue: z.string(),
            originalCode: z.string(),
            suggestedEdit: z.string(),
        }),
    ).optional(),
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
            throw new Error("LM Studio server is running, but no model is loaded into memory.\n" +
                "👉 Run 'lms load <model name> -y' in your terminal to load a model.")
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

    const response = await client.chat.completions.create({
        model: process.env.REVIEWER_MODEL as string,
        messages: [
            createPrompt("system", changedFiles, null),
            createPrompt("user", null, diff),
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
    });

    const endTime = performance.now();
    const durationMs = Math.round(endTime - startTime);

    try {
        const rawText = response.choices[0].message.content || '';
        const cleanedText = rawText
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .replace(/[\u00A0\u200B]/g, ' ')
            .trim();

        const parsedJson = JSON.parse(cleanedText);
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
        throw new Error(`Failed to parse or validate LLM response as JSON. \n\nError: ${error}`);
    }
}

export {
    reviewCodeDiff,
};