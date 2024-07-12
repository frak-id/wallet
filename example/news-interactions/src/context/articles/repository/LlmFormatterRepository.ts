import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { DI } from "@frak-labs/shared/context/utils/di";

class LlmFormatterRepository {
    private client: BedrockRuntimeClient;

    constructor() {
        this.client = new BedrockRuntimeClient({ region: "eu-west-3" });
    }

    /**
     * Format news text
     * @param news
     */
    public async formatNews(news: {
        title: string;
        text: string;
        summary: string;
    }) {
        const basePrompt = `You are a News Chief Editor assistant, you take as input a news article content (title, summary and text), and you should output a fixed and formatted news text content.\nYour goal is to remove any incoherent stuff in the text, format it  sections (max 3 sections per news) and paragraph, a few bold words if you find it necessary. You should output the text, and only the text, in the markdown format.\nTitle: ${news.title}\nSummary: ${news.summary}\nText: ${news.text}`;
        const prompt = `<s>[INST] ${basePrompt} [/INST]`;

        const payload = {
            prompt,
            max_tokens: 4096,
            temperature: 0.5,
        };
        const command = new InvokeModelCommand({
            contentType: "application/json",
            body: JSON.stringify(payload),
            modelId: "mistral.mistral-7b-instruct-v0:2",
        });
        const apiResponse = await this.client.send(command);
        // Decode and return the response.
        const decodedResponseBody = new TextDecoder().decode(apiResponse.body);
        const responseBody = JSON.parse(decodedResponseBody);
        return responseBody.outputs[0].text;
    }
}

export const getLlmFormatterRepository = DI.registerAndExposeGetter({
    id: "LlmFormatterRepository",
    getter: () => {
        return new LlmFormatterRepository();
    },
});
