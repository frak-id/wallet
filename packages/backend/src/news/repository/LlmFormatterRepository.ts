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
    }): Promise<string> {
        const basePrompt = `Rewrite the following news content in the style of The Guardian newspaper. Format the output in Markdown with these requirements:
1. Write at least 3 paragraphs, more if needed.
2. Use a clear, factual, and slightly formal tone.
3. Start with a strong opening paragraph summarizing key points.
4. Develop the story with context and details in subsequent paragraphs.
5. Use **bold** for key names or organizations when first mentioned.
6. Format any relevant quotes using > blockquotes.
7. Conclude with perspective or implications of the news.
9. No Html allowed in the output, only markdown.
10. Your answer will be interpreted directly to be displayed. It should be ready to go.

News content to rewrite:
${news.text}`;
        const promptCommand = `<s>[INST] ${basePrompt} [/INST]`;

        const payload = {
            prompt: promptCommand,
            max_tokens: 4096,
            temperature: 0.2,
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
    getter: () => new LlmFormatterRepository(),
});
