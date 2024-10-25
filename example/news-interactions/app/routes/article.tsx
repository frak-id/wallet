import { NewsArticle } from "@/module/news/component/NewsArticle";
import { backendApi } from "@frak-labs/shared/context/server/backendClient";
import { type LoaderFunction, json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { QueryClient, dehydrate } from "@tanstack/react-query";

export const loader: LoaderFunction = async ({ request }) => {
    const url = new URL(request.url);
    const articleId = url.searchParams.get("id");

    if (!articleId) {
        return json({ dehydratedState: {}, articleId: null });
    }

    const queryClient = new QueryClient();

    await queryClient.prefetchQuery({
        queryKey: ["news", "full", articleId],
        queryFn: async () => {
            const result = await backendApi.exampleNewsPaper
                .news({ id: articleId })
                .get();
            return result.data;
        },
    });

    return json({ dehydratedState: dehydrate(queryClient), articleId });
};

export default function Article() {
    const { articleId } = useLoaderData<typeof loader>();

    if (!articleId) {
        // Invalid article
        return <h1>Invalid article</h1>;
    }

    return <NewsArticle articleId={articleId} />;
}
