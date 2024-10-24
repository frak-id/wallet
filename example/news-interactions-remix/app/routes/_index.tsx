import { NewsList } from "@/module/news/component/NewsList";
import { backendApi } from "@frak-labs/shared/context/server/backendClient";
import { type LoaderFunction, json } from "@remix-run/node";
import { QueryClient, dehydrate } from "@tanstack/react-query";

export const loader: LoaderFunction = async () => {
    const queryClient = new QueryClient();

    await queryClient.prefetchQuery({
        queryKey: ["news", "list"],
        queryFn: async () => {
            const result = await backendApi.exampleNewsPaper.news.home.get();
            return result.data;
        },
    });

    return json({ dehydratedState: dehydrate(queryClient) });
};

export default function Index() {
    return <NewsList />;
}
