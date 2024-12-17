import { ImageRemote } from "@/module/common/component/ImageRemote";
import type { LightNews } from "@/types/News";
import type { PropsWithChildren } from "react";
import { Link } from "react-router";
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
        <li>
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
        <Link
            viewTransition
            className={styles.listItem__link}
            to={`/article?id=${id}`}
        >
            <h2 className={styles.listItem__titleTop}>{title}</h2>
        </Link>
    );
}

function ItemWithoutSummary({ news }: { news: LightNews }) {
    const { id, image, title } = news;
    return (
        <Link
            className={styles.listItem__link}
            to={`/article?id=${id}`}
            viewTransition
        >
            <ImageRemote
                image={image}
                title={title}
                width={120}
                height={120}
                className={styles.listItem__image}
            />
            <h2 className={styles.listItem__title}>{title}</h2>
        </Link>
    );
}

function ItemWithSummary({ news }: { news: LightNews }) {
    const { id, image, title, summary } = news;
    return (
        <Link to={`/article?id=${id}`} viewTransition>
            <h2 className={styles.listItem__title}>{title}</h2>
            <span className={styles.listItem__contentSummary}>
                <p className={styles.listItem__textSummary}>{summary}</p>
                <ImageRemote
                    image={image}
                    title={title}
                    width={70}
                    height={70}
                    className={styles.listItem__imageSummary}
                />
            </span>
        </Link>
    );
}

export function ItemSwiper({ news }: { news: LightNews }) {
    const { id, title, image } = news;
    return (
        <Link
            to={`/article?id=${id}`}
            viewTransition
            className={styles.listItemSwiper}
        >
            <ImageRemote
                image={image}
                title={title}
                width={200}
                height={200}
                className={styles.listItemSwiper__image}
            />
            <h2 className={styles.listItemSwiper__title}>{title}</h2>
        </Link>
    );
}
