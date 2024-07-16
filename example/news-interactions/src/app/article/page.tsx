import { NewsArticlePage } from "@/module/news/component/NewsArticlePage";
import { Spinner } from "@module/component/Spinner";
import { Suspense } from "react";

export default function NewsArticlePageWrapper() {
    return (
        <Suspense fallback={<Spinner />}>
            <NewsArticlePage />
        </Suspense>
    );
}
