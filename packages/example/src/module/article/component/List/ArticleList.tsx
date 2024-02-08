"use client";

import { getAllArticles } from "@/context/article/action/get";
import type { Article } from "@/type/Article";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

export function ArticleList() {
    const { data: articles, isPending: isLoading } = useQuery({
        queryKey: ["articles"],
        queryFn: () => getAllArticles(),
        refetchInterval: 120_000,
    });

    // List all the articles
    return (
        <div>
            {isLoading ? (
                <p>Loading...</p>
            ) : (
                <ArticlesContainer articles={articles} />
            )}
        </div>
    );
}

function ArticlesContainer({ articles }: { articles?: Article[] }) {
    return (
        <ul>
            {articles?.map((article) => (
                <li key={article.id}>
                    <Link href={article.link}>{article.title}</Link>
                </li>
            ))}
        </ul>
    );
}
