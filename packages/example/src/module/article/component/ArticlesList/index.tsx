"use client";

import { getAllArticles } from "@/context/article/action/get";
import { Skeleton } from "@/module/common/component/Skeleton";
import type { Article } from "@/type/Article";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import styles from "./index.module.css";

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
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                </>
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
                    <Link
                        href={article.link}
                        className={styles.articlesList__item}
                    >
                        <img
                            src={article.imageUrl}
                            width={358}
                            height={358}
                            loading={"lazy"}
                            className={styles.articlesList__image}
                            alt={article.title}
                        />
                        <h2 className={styles.articlesList__title}>
                            {article.title}
                        </h2>
                        <span className={styles.articlesList__description}>
                            {article.description}
                        </span>
                    </Link>
                </li>
            ))}
        </ul>
    );
}
