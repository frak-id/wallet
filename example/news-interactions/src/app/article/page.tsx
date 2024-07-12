"use client";

import { getNewsById } from "@/context/articles/actions/getNews";
import { Spinner } from "@module/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export default function NewsArticlePage() {
    const searchParams = useSearchParams();
    const articleId = useMemo(() => searchParams.get("id"), [searchParams.get]);

    if (!articleId) {
        // Invalid article
        return <h1>Invalid article</h1>;
    }

    return <ArticleComponent articleId={articleId} />;
}

function ArticleComponent({ articleId }: { articleId: string }) {
    const { data: article } = useQuery({
        queryKey: ["news", "full", articleId],
        queryFn: async () => {
            return getNewsById(articleId);
        },
        enabled: !!articleId,
    });

    if (!article) {
        return <Spinner />;
    }

    return (
        <div>
            <h1>{article.title}</h1>
            <p>{article.summary}</p>
            <img src={article.image} alt={article.title} />
            <p>{article.text}</p>
        </div>
    );
}
