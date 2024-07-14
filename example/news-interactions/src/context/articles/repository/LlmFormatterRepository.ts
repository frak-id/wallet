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
        const basePrompt = `IMPORTANT: Your task is to format the text, not to rewrite or summarize it. The content must remain exactly the same, only adding markdown formatting.
You are an expert news editor and markdown formatter. Your task is to take the main body of unformatted news articles and convert them into well-structured markdown format. Do not include the title or summary in your output. Here are your instructions:
1. Remove any irrelevant elements like "Share with Facebook" or other social media prompts.
2. Break the text into paragraphs for better readability.
3. Use bold text (**) for important names, places, or key concepts.
4. If there are quotes in the text, format them using markdown blockquotes (>).
5. If there are lists in the content, format them as proper markdown lists (- or 1., 2., 3.).
6. Add a horizontal rule (---) between major sections if appropriate.
7. If there are any dates or time-sensitive information, consider adding them near the beginning of the formatted text.
8. Do not include the article's title or summary in your output.
9. Start your formatted text directly with the main body content.
Here's the news article to format:
${news.text}

Please provide only the reformatted main body of the article in markdown, without the title or summary.`;
        const prompt = `<s>[INST] ${basePrompt} [/INST]`;

        const payload = {
            prompt,
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
    getter: () => {
        return new LlmFormatterRepository();
    },
});
