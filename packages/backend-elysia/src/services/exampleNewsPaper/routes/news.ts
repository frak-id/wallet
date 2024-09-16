import { t } from "elysia";
import type { NewsPaperContextApp } from "../context";
import { FullNewsDto, LightNewsDto } from "../models/NewsModel";
import {
    newsDocumentToFullNews,
    newsDocumentToLightNews,
} from "../models/mapper/newsDtoToModel";

/**
 * All the route related to news fetching
 * @param app
 */
export const newsRoutes = (app: NewsPaperContextApp) =>
    app
        // Fetch news for the home page
        .get(
            "/news/home",
            async () => {
                // Fetching the repository from the decorator, since idk why it's not populated inside the context
                const { newsDbRepository } = app.decorator;
                // Get the 3 latest news
                const latestNews = await newsDbRepository.getLatestNews({
                    limit: 3,
                    offset: 0,
                });

                // Get top 10 positive news
                const latestPositiveNews =
                    await newsDbRepository.getMostPositiveNews({
                        limit: 5,
                        offset: 0,
                    });

                // Get the 5 most positive news
                const positiveNews = latestPositiveNews.slice(0, 5);
                const featuredNews = latestPositiveNews.slice(5, 10);

                // Get a random news
                const randomNews = await newsDbRepository.getRandomNews();

                // Get a hero news
                const heroNews = await newsDbRepository.getRandomNews();

                return {
                    positives: positiveNews.map(newsDocumentToLightNews),
                    featured: featuredNews.map(newsDocumentToLightNews),
                    latest: latestNews.map(newsDocumentToLightNews),
                    quickByte: newsDocumentToLightNews(randomNews),
                    hero: newsDocumentToLightNews(heroNews),
                };
            },
            {
                response: t.Object({
                    positives: t.Array(LightNewsDto),
                    featured: t.Array(LightNewsDto),
                    latest: t.Array(LightNewsDto),
                    quickByte: LightNewsDto,
                    hero: LightNewsDto,
                }),
            }
        )
        // Get news from its id
        .get(
            "/news/:id",
            async ({ params: { id } }) => {
                // Fetching the repository from the decorator, since idk why it's not populated inside the context
                const { newsDbRepository } = app.decorator;

                const document = await newsDbRepository.getNewsById(id);
                if (!document) return null;

                return newsDocumentToFullNews(document);
            },
            {
                params: t.Object({
                    id: t.String(),
                }),
                response: t.Union([FullNewsDto, t.Null()]),
            }
        );
