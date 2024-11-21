import { NewsArticle } from "@/module/news/component/NewsArticle";
import type { LoaderFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);
    const articleId = url.searchParams.get("id");

    if (!articleId) {
        return { articleId: null };
    }

    return { articleId };
};

export default function Article() {
    const { articleId } = useLoaderData<typeof loader>();

    if (!articleId) {
        // Invalid article
        return <h1>Invalid article</h1>;
    }

    return <NewsArticle articleId={articleId} />;
}
