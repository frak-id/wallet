import type { LightNews } from "@/types/News";
import Link from "next/link";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function List({ children }: PropsWithChildren) {
    return <ul className={styles.list}>{children}</ul>;
}

function ListItem({ news, top = false }: { news: LightNews; top?: boolean }) {
    const { summary } = news;

    function Component() {
        if (top) {
            return <ItemTop news={news} />;
        }

        if (!summary) {
            return <ItemWithoutSummary news={news} />;
        }

        return <ItemWithSummary news={news} />;
    }

    return (
        <li className={styles.listItem}>
            <article>
                <Component />
            </article>
        </li>
    );
}

List.Item = ListItem;

function ItemTop({ news }: { news: LightNews }) {
    const { id, title } = news;
    return (
        <Link className={styles.listItem__link} href={`/article?id=${id}`}>
            <h2 className={styles.listItem__titleTop}>{title}</h2>
        </Link>
    );
}

function ItemWithoutSummary({ news }: { news: LightNews }) {
    const { id, image, title } = news;
    return (
        <Link className={styles.listItem__link} href={`/article?id=${id}`}>
            {image && (
                <img
                    className={styles.listItem__image}
                    src={image}
                    alt={title}
                />
            )}
            <h2 className={styles.listItem__title}>{title}</h2>
        </Link>
    );
}

function ItemWithSummary({ news }: { news: LightNews }) {
    const { id, image, title, summary } = news;
    return (
        <Link
            className={styles.listItem__linkSummary}
            href={`/article?id=${id}`}
        >
            <h2 className={styles.listItem__title}>{title}</h2>
            <span className={styles.listItem__contentSummary}>
                <p className={styles.listItem__textSummary}>{summary}</p>
                {image && (
                    <img
                        className={styles.listItem__imageSummary}
                        src={image}
                        alt={title}
                    />
                )}
            </span>
        </Link>
    );
}
