import { ImageRemote } from "@/module/common/component/ImageRemote";
import type { ComponentPropsWithRef } from "react";
import { Link } from "react-router";
import styles from "./index.module.css";

export const Hero = ({
    ref,
    id,
    image,
    title,
    isArticle,
}: ComponentPropsWithRef<"h1"> & {
    id: string;
    image: string;
    title: string;
    isArticle?: boolean;
}) => {
    const Content = (
        <>
            <ImageRemote
                image={image}
                title={title}
                width={600}
                height={600}
                className={styles.hero__image}
            />
            <h1 className={styles.hero__title} ref={ref}>
                {title}
            </h1>
        </>
    );

    return (
        <div className={styles.hero}>
            {isArticle ? (
                <span>{Content}</span>
            ) : (
                <Link to={`/article?id=${id}`} viewTransition>
                    {Content}
                </Link>
            )}
        </div>
    );
};

Hero.displayName = "Hero";
