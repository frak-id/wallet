import { ImageRemote } from "@/module/common/component/ImageRemote";
import { Link } from "next-view-transitions";
import { forwardRef } from "react";
import styles from "./index.module.css";

export const Hero = forwardRef<
    HTMLHeadingElement,
    { id: string; image: string; title: string }
>(({ id, image, title }, ref) => {
    return (
        <div className={styles.hero}>
            <Link href={`/article?id=${id}`}>
                <ImageRemote
                    priority={true}
                    image={image}
                    title={title}
                    width={600}
                    height={600}
                    className={styles.hero__image}
                />
                <h1 className={styles.hero__title} ref={ref}>
                    {title}
                </h1>
            </Link>
        </div>
    );
});

Hero.displayName = "Hero";
