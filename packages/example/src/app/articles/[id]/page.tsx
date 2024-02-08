"use client";

import { getArticle } from "@/context/article/action/get";
import { ReadArticle } from "@/module/article/component/Read";
import { parseUnlockRequestResult } from "@frak-wallet/sdk";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import type { Hex } from "viem";

export default function ArticlePage({ params }: { params: { id: string } }) {
    // Fetch the articles
    const { data: article, isPending: isFetchingArticle } = useQuery({
        queryKey: ["getArticle", params.id],
        queryFn: async () => getArticle(params.id as Hex),
        enabled: !!params.id,
    });

    // Access the query params
    const { get, size: queryParamSize } = useSearchParams();

    // Get the unlock data response (if any)
    const {
        data: unlockResult,
        isPending: isParsingUnlockResult,
        error: unlockParsingError,
    } = useQuery({
        queryKey: ["getUnlockResponse", params.id, article?.id],
        queryFn: async () => {
            const result = get("result");
            const hash = get("hash");
            if (!(result && hash)) {
                throw new Error("Invalid unlock result");
            }

            // Parse the data and return them
            return await parseUnlockRequestResult({ result, hash });
        },
        enabled: !!article?.id && queryParamSize > 0,
    });

    useEffect(() => {
        console.log("Unlock result", unlockResult);
        console.log("Unlock error", unlockParsingError);
    }, [unlockResult, unlockParsingError]);

    // If we are loading display another component
    if (isFetchingArticle) {
        return <h1>Loading...</h1>;
    }

    // If no article found display a component
    if (!article) {
        return <h1>Article not found</h1>;
    }

    return (
        <div>
            <ReadArticle article={article} />

            <br />
            <br />

            {isParsingUnlockResult && <p>Parsing unlock result...</p>}
            {unlockParsingError && (
                <p>Parsing unlock error {JSON.stringify(unlockParsingError)}</p>
            )}
            {unlockResult && <p>Unlock result: {unlockResult.status}</p>}
        </div>
    );
}
