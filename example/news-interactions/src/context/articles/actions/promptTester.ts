"use server";

import { getLlmFormatterRepository } from "@/context/articles/repository/LlmFormatterRepository";
import type { FullNews } from "@/types/News";

export async function testPromptOnNewsText({
    prompt,
    news,
}: { prompt: string; news: FullNews }): Promise<string> {
    const llmFormatter = getLlmFormatterRepository();
    return llmFormatter.formatNews(
        { title: news.title, summary: news.summary, text: news.originalText },
        prompt
    );
}
