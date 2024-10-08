import { t } from "elysia";

export const LightNewsDto = t.Object({
    id: t.String(),
    title: t.String(),
    summary: t.String(),
    image: t.String(),
    sourceCountry: t.String(),
    author: t.String(),
    publishDate: t.Date(),
    category: t.Optional(t.String()),
});
export type LightNews = typeof LightNewsDto.static;

export const FullNewsDto = t.Intersect([
    LightNewsDto,
    t.Object({
        text: t.String(),
        url: t.String(),
    }),
]);
export type FullNews = typeof FullNewsDto.static;
