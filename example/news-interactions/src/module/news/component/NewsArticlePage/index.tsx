"use client";

import { Header } from "@/module/common/component/Header";
import { NewsArticle } from "@/module/news/component/NewsArticle";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export function NewsArticlePage() {
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
