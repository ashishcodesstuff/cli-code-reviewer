import dotenv from "dotenv";
import z from 'zod';

dotenv.config({quiet: true});

const EnvSchema = z.object({
    SERVER_URL: z.url({error: "SERVER_URL must be a valid url"}).optional(),
    REVIEWER_MODEL: z.string({error: "REVIEWER_MODEL must be provided"}),
    SERVER_API_KEY: z.string({error: "SERVER_API_KEY is required"}),
    RESPONSE_FORMAT: z.string().optional(),
});

export interface Config {
    serverUrl: string | undefined;
    reviewerModel: string;
    apiKey: string;
    responseFormat?: string,
}

function getEnvConfig(env: NodeJS.ProcessEnv = process.env): Config {
    const parsed = EnvSchema.safeParse(env);

    if(!parsed.success) {
        throw new Error(`Invalid configuration: \n ${z.prettifyError(parsed.error)}`);
    }

    const e = parsed.data;

    return {
        serverUrl: e.SERVER_URL,
        reviewerModel: e.REVIEWER_MODEL,
        apiKey: e.SERVER_API_KEY,
        responseFormat: e.RESPONSE_FORMAT || "json_object",
    };
}

export {
    getEnvConfig,
};