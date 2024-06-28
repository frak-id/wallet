"use client";

import { getAllArticles } from "@/context/article/action/get";
import { ArticleItem } from "@/module/article/component/ArticleItem";
import { Skeleton } from "@/module/common/component/Skeleton";
import { useSiweAuthenticate } from "@frak-labs/nexus-sdk/react";
import { useQuery } from "@tanstack/react-query";

export function ArticlesList() {
    const { data: articles, isPending: isLoading } = useQuery({
        queryKey: ["articles"],
        queryFn: () => getAllArticles(),
    });

    // List all the articles
    return (
        <div>
            {isLoading ? (
                <>
                    <Skeleton height={383} />
                    <Skeleton height={383} />
                    <Skeleton height={383} />
                </>
            ) : (
                <ul>
                    {articles?.map((article, index) => (
                        <ArticleItem
                            article={article}
                            index={index}
                            key={article.id}
                        />
                    ))}
                </ul>
            )}
            <TestAuth />
        </div>
    );
}

function TestAuth() {
    const { mutate: authenticate } = useSiweAuthenticate({
        mutations: {
            onSuccess: (data, variables, context) => {
                console.log("Cross domain success", {
                    data,
                    variables,
                    context,
                });
            },
            onError: (error, variables, context) => {
                console.error("Cross domain error", {
                    error,
                    variables,
                    context,
                });
            },
        },
    });

    return (
        <button
            type={"button"}
            onClick={() => {
                authenticate({});
            }}
        >
            Test Cross Domain Auth
        </button>
    );
}
