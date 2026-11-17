import z from 'zod';
import { ReviewMetrics, ReviewSchema, FullReviewResponse } from "./reviewer.js";

export function processAndMergeChunks(responses: FullReviewResponse[]): FullReviewResponse {
    const mergedResult: z.infer<typeof ReviewSchema> = {
        riskLevel: "LOW",
        securityVulnerabilities: [],
        suggestedRefactors: [],
        missingTestFiles: [],
        remediations: [],
    };

    const aggregatedMetrics: ReviewMetrics = {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: 0,
    };

    const riskPriority: Record<"LOW" | "MEDIUM" | "HIGH", number> = {
        LOW: 1,
        MEDIUM: 2,
        HIGH: 3,
    };

    for (const res of responses) {
        aggregatedMetrics.promptTokens += res.metrics.promptTokens;
        aggregatedMetrics.completionTokens += res.metrics.completionTokens;
        aggregatedMetrics.totalTokens += res.metrics.totalTokens;
        aggregatedMetrics.durationMs += res.metrics.durationMs;

        // 2. Escalate to the highest risk level found
        if (riskPriority[res.result.riskLevel] > riskPriority[mergedResult.riskLevel]) {
            mergedResult.riskLevel = res.result.riskLevel;
        }

        mergedResult.securityVulnerabilities.push(...(res.result.securityVulnerabilities) || []);
        mergedResult.suggestedRefactors.push(...(res.result.suggestedRefactors) || []);
        mergedResult.missingTestFiles.push(...(res.result.missingTestFiles) || []);

        if (res.result.remediations) {
            if (!mergedResult.remediations) mergedResult.remediations = [];
            for (const rem of res.result.remediations) {
                const exists = mergedResult.remediations.some(
                    existing => existing.filePath === rem.filePath && existing.originalCode === rem.originalCode
                );

                if (!exists) {
                    mergedResult.remediations.push(rem);
                }
            }
        }
    }

    mergedResult.missingTestFiles = Array.from(new Set(mergedResult.missingTestFiles));
    mergedResult.securityVulnerabilities = Array.from(new Set(mergedResult.securityVulnerabilities));
    mergedResult.suggestedRefactors = Array.from(new Set(mergedResult.suggestedRefactors));

    return {
        result: mergedResult,
        metrics: aggregatedMetrics,
    };
}