"use client";
import { NewsArticleComponent } from "@/module/news/component/Article";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function NewsArticlePage() {
    const searchParams = useSearchParams();
    const articleId = useMemo(() => searchParams.get("id"), [searchParams.get]);

    if (!articleId) {
        // Invalid article
        return <h1>Invalid article</h1>;
    }

    return <NewsArticleComponent articleId={articleId} />;
}
