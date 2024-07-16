"use client";

import { Header } from "@/module/common/component/Header";
import { NewsArticle } from "@/module/news/component/NewsArticle";
import { Spinner } from "@module/component/Spinner";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

export default function NewsArticlePageWrapper() {
    return (
        <Suspense fallback={<Spinner />}>
            <NewsArticlePage />
        </Suspense>
    );
}

function NewsArticlePage() {
    const searchParams = useSearchParams();
    const articleId = useMemo(() => searchParams.get("id"), [searchParams.get]);

    if (!articleId) {
        // Invalid article
        return <h1>Invalid article</h1>;
    }

    return (
        <>
            <Header inArticle={true} />
            <NewsArticle articleId={articleId} />
        </>
    );
}
