import {
    BedrockRuntimeClient,
    InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const newsReformatingPrompt = `Rewrite the following news content in the style of The Guardian newspaper. Format the output in Markdown with these requirements:
1. Write at least 3 paragraphs, more if needed.
2. Use a clear, factual, and slightly formal tone.
3. Start with a strong opening paragraph summarizing key points.
4. Conclude with perspective or implications of the news.
5. No Html allowed in the output, only markdown.
6. Your answer will be interpreted directly to be displayed. It should be ready to go.

News content to rewrite:
`;

const newsSummaryPrompt = `Create a summary of the given news content, focus on the key points. 
The summary should be engaging and informative, with a maximum of 300 character. 
No Html allowed in the output. 
Your answer will be interpreted directly to be displayed. It should be ready to go.`;

export class LlmFormatterRepository {
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
        summary?: string;
    }): Promise<string> {
        const basePrompt = `${newsReformatingPrompt}
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

    /**
     * Format news text
     * @param news
     */
    public async getSummary(news: {
        title: string;
        text: string;
        summary?: string;
    }): Promise<string> {
        const basePrompt = `${newsSummaryPrompt}
        title:${news.text}
        content:${news.text}`;
        const promptCommand = `<s>[INST] ${basePrompt} [/INST]`;

        const payload = {
            prompt: promptCommand,
            max_tokens: 1024,
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
