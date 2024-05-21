"use client";

import type { Article } from "@/type/Article";
import Link from "next/link";
import { useMemo } from "react";
import ReactDOM from "react-dom";
import styles from "./index.module.css";

export function ArticleItem({
    article,
    index,
}: { article: Article; index: number }) {
    // Only preload the first two articles in top priority
    if (index < 2) {
        ReactDOM.preload(imageMobile(imageAsWebP(article.imageUrl)), {
            as: "image",
            fetchPriority: "high",
        });
        ReactDOM.preload(imageAsWebP(article.imageUrl), {
            as: "image",
            fetchPriority: "high",
        });
    }

    const url = useMemo(() => {
        return `${article.link}&isFree=${index === 0 ? 1 : 0}`;
    }, [article.link, index]);

    return (
        <li>
            <Link href={url} className={styles.articleItem}>
                <img
                    src={imageMobile(imageAsWebP(article.imageUrl))}
                    srcSet={`
                        ${imageMobile(imageAsWebP(article.imageUrl))} 400w,
                        ${imageAsWebP(article.imageUrl)} 558w`}
                    width={358}
                    height={358}
                    loading={index > 1 ? "lazy" : undefined}
                    className={styles.articleItem__image}
                    alt={article.title}
                    fetchPriority={index > 1 ? "high" : undefined}
                    sizes="50vw"
                />
                <h2 className={styles.articleItem__title}>{article.title}</h2>
                <span className={styles.articleItem__description}>
                    {article.description}
                </span>
            </Link>
        </li>
    );
}

function imageAsWebP(imageUrl: string) {
    return imageUrl.replace(".jpeg", ".webp");
}

function imageMobile(imageUrl: string) {
    return imageUrl.replace(".webp", "-mobile.webp");
}
