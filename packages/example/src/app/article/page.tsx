"use client";

import { getArticleReadyToRead } from "@/context/article/action/get";
import { ReadArticle } from "@/module/article/component/Read";
import { Skeleton } from "@/module/common/component/Skeleton";
import { parseUnlockRequestResult } from "@frak-wallet/sdk";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Hex } from "viem";

export default function ArticlePage() {
    return (
        <Suspense fallback={<h1>Loading...</h1>}>
            <ArticlePageComponent />
        </Suspense>
    );
}

function ArticlePageComponent() {
    // Get the article id
    const { get, has, size: queryParamSize } = useSearchParams();
    const [articleId, setArticleId] = useState<Hex | null>(null);

    useEffect(() => {
        const id = get("id") as Hex | null;
        setArticleId(id);
    }, [get]);

    // Fetch the articles
    const { data: article, isPending: isFetchingArticle } = useQuery({
        queryKey: ["getArticle", articleId ?? "undefined"],
        queryFn: async () => {
            if (!articleId) {
                throw new Error("Invalid article id");
            }
            return getArticleReadyToRead(articleId);
        },
        enabled: !!articleId,
    });

    // Get the unlock data response (if any)
    const { data: unlockResult } = useQuery({
        queryKey: ["parseUnlockResult", articleId, article?.id],
        queryFn: async () => {
            const result = get("result");
            const hash = get("hash");
            if (!(result && hash)) {
                throw new Error("Invalid unlock result");
            }

            // Parse the data and return them
            return await parseUnlockRequestResult({ result, hash });
        },
        enabled:
            !!articleId &&
            !!article?.id &&
            queryParamSize > 0 &&
            has("result") &&
            has("hash"),
    });

    if (!articleId) {
        return <h1>Invalid article</h1>;
    }

    // If we are loading display another component
    if (isFetchingArticle) {
        return (
            <div style={{ margin: "16px" }}>
                <Skeleton />
            </div>
        );
    }

    // If no article found display a component
    if (!article) {
        return <h1>Article not found</h1>;
    }

    return <ReadArticle article={article} unlockStatusRequest={unlockResult} />;
}
