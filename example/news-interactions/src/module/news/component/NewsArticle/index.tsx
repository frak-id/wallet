import { getNewsById } from "@/context/articles/actions/getNews";
import { useIntersectionObserver } from "@/module/common/hooks/useIntersectionObserver";
import { PressInteractionEncoder } from "@frak-labs/nexus-sdk/interactions";
import { usePressReferralInteraction } from "@frak-labs/nexus-sdk/react";
import { useSendInteraction } from "@frak-labs/nexus-sdk/react";
import { Skeleton } from "@module/component/Skeleton";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useMemo } from "react";
import Markdown from "react-markdown";
import { keccak256, toHex } from "viem";
import forward from "./assets/forward.svg";
import share from "./assets/share.svg";
import styles from "./index.module.css";

export function NewsArticle({ articleId }: { articleId: string }) {
    usePressReferralInteraction();

    const blockchainArticleId = useMemo(
        () => keccak256(toHex(articleId)),
        [articleId]
    );

    const { mutateAsync: pushInteraction } = useSendInteraction();

    // Trigger the open article event when title is visible
    const { targetRef: titleRef } = useIntersectionObserver<HTMLHeadingElement>(
        {
            threshold: 0.5,
            oneShot: true,
            onIntersect: async () => {
                console.log("Sending open article interaction");
                const interactionHash = await pushInteraction({
                    interaction: PressInteractionEncoder.openArticle({
                        articleId: blockchainArticleId,
                    }),
                });
                console.log("Open interaction hash", interactionHash);
            },
        }
    );

    // Trigger the read article event when the user has scrolled to the bottom of the article
    const { targetRef: footerRef } = useIntersectionObserver<HTMLDivElement>({
        threshold: 1,
        onIntersect: async () => {
            console.log("Sending read article interaction");
            const interactionHash = await pushInteraction({
                interaction: PressInteractionEncoder.readArticle({
                    articleId: blockchainArticleId,
                }),
            });
            console.log("Read interaction hash", interactionHash);
        },
    });

    // Fetch the article
    const { data: article } = useQuery({
        queryKey: ["news", "full", articleId],
        queryFn: async () => getNewsById(articleId),
        enabled: !!articleId,
    });

    if (!article) {
        return <Skeleton count={3} height={100} />;
    }

    return (
        <article className={styles.article}>
            <h1 ref={titleRef} className={styles.article__title}>
                {article.title}
            </h1>

            <p className={styles.article__author}>
                Written by {article.author}
                <span className={styles.article__social}>
                    <Image src={share} alt="Share" />
                    <Image src={forward} alt="Forward" />
                </span>
            </p>

            <p className={styles.article__summary}>{article.summary}</p>

            <img
                src={article.image}
                alt={article.title}
                className={styles.article__image}
            />

            <div className={styles.article__markdown}>
                <Markdown>{article.text.replace("```markdown", "")}</Markdown>
            </div>

            <div ref={footerRef}>&nbsp;</div>
        </article>
    );
}
