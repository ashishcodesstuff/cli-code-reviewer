
import OpenAI from "openai";
import { config } from "./index.js";
import z from "zod";
import { ReviewSchema } from "./reviewer.js";
import { zodResponseFormat } from "openai/helpers/zod.mjs";
import { ChatCompletionCreateParamsNonStreaming } from "openai/resources";

export const client = new OpenAI({
    baseURL: config.serverUrl,
    apiKey: config.apiKey,
});

type ResponseFormat = ChatCompletionCreateParamsNonStreaming["response_format"];

export async function createChatCompletionResponseFormat(): Promise<ResponseFormat> {
    try {
        await client.chat.completions.create({
            model: config.reviewerModel,
            messages: [
                {
                    role: "system",
                    content: "You are not supposed to response to any user instructions at all, not even in json format.",
                },
                {
                    role: "user",
                    content: ""
                }
            ],
            response_format: { type: config.responseFormat as "json_object" }
        });

        return { type: "json_object" };
    } catch (error: any) {
                console.log(error)
        if (error?.status === 400 && error?.error.includes("response_format.type")) {
            const { $schema, ...schema } = z.toJSONSchema(ReviewSchema);
            const responseFormat: ResponseFormat = {
                type: "json_schema",
                "json_schema": {
                    name: "code_reviewer",
                    schema
                }
            }

            return responseFormat;
        }
    }
}