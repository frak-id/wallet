"use client";

import { getArticle } from "@/context/article/action/get";
import { ReadArticle } from "@/module/article/component/Read";
import { Skeleton } from "@/module/common/component/Skeleton";
import { decodeStartUnlockReturn } from "@frak-labs/nexus-sdk/actions";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { Hex } from "viem";

export default function ArticlePage() {
    return (
        <div id={"theme-article"}>
            <Suspense fallback={<h1>Loading...</h1>}>
                <ArticlePageComponent />
            </Suspense>
        </div>
    );
}

function ArticlePageComponent() {
    // Get the article id
    const searchParams = useSearchParams();
    const [articleId, setArticleId] = useState<Hex | null>(null);
    const [isFree, setIsFree] = useState<boolean>(false);

    useEffect(() => {
        const id = searchParams.get("id") as Hex | null;
        const isFree = searchParams.get("isFree") as string | null;
        setIsFree(isFree === "1" ?? false);
        setArticleId(id);
    }, [searchParams.get]);

    // Fetch the articles
    const { data: article, isPending: isFetchingArticle } = useQuery({
        queryKey: ["getArticle", articleId ?? "undefined"],
        queryFn: async () => {
            if (!articleId) {
                throw new Error("Invalid article id");
            }
            return getArticle(articleId);
        },
        enabled: !!articleId,
    });

    // Get the unlock data response (if any)
    useQuery({
        queryKey: ["parseUnlockResult", articleId, article?.id],
        queryFn: async () => {
            const result = searchParams.get("result");
            const hash = searchParams.get("hash");
            if (!(result && hash)) {
                throw new Error("Invalid unlock result");
            }

            // Parse the data and return them
            return await decodeStartUnlockReturn({
                result,
                hash,
            });
        },
        enabled:
            !!articleId &&
            !!article?.id &&
            searchParams.size > 0 &&
            searchParams.has("result") &&
            searchParams.has("hash"),
    });

    // If we are loading display another component
    if (!articleId || isFetchingArticle) {
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

    return <ReadArticle article={article} isFree={isFree} />;
}
