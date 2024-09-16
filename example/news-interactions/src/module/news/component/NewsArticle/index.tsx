"use client";

import { Skeleton } from "@/module/common/component/Skeleton";
import { useIntersectionObserver } from "@/module/common/hooks/useIntersectionObserver";
import { Hero } from "@/module/news/component/Hero";
import {
    PressInteractionEncoder,
    ReferralInteractionEncoder,
} from "@frak-labs/nexus-sdk/interactions";
import {
    useDisplayModal,
    useReferralInteraction,
} from "@frak-labs/nexus-sdk/react";
import { useSendInteraction } from "@frak-labs/nexus-sdk/react";
import { backendApi } from "@frak-labs/shared/context/server/backendClient";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { useMemo } from "react";
import Markdown from "react-markdown";
import { keccak256, toHex } from "viem";
import forward from "./assets/forward.svg";
import styles from "./index.module.css";

const modalConfig = {
    steps: {
        openSession: {
            metadata: {
                title: "Open reward session",
                description:
                    "We have set up Nexus, a solution to remunerate our users and customers for the value they create by sharing our product. This solution, which is an alternative to cookies, enables us to measure the use and performance of our services. Your choice will only be valid on the digital support you are currently using. If you log in to your Asics account, your Nexus ID will be associated with it. To find out more about how we and our partners use your personal data please read our privacy policy.",
                primaryActionText: "Being rewarded with Nexus",
            },
        },
        login: {
            metadata: {
                title: "Login",
                description:
                    "We have set up Nexus, a solution to remunerate our users and customers for the value they create by sharing our product. This solution, which is an alternative to cookies, enables us to measure the use and performance of our services. Your choice will only be valid on the digital support you are currently using. If you log in to your Asics account, your Nexus ID will be associated with it. To find out more about how we and our partners use your personal data please read our privacy policy.",
                primaryActionText: "Login with Nexus",
                secondaryActionText: "Create a Nexus",
            },
            allowSso: true,
            ssoMetadata: {
                logoUrl: "https://news-paper.xyz/favicons/icon-192.png",
                homepageLink: "https://news-paper.xyz/",
            },
        },
        success: {
            metadata: {
                description: "You have successfully been rewarded",
            },
        },
    },
    metadata: {
        header: {
            title: "Payment for your data",
        },
    },
} as const;

export function NewsArticle({ articleId }: { articleId: string }) {
    useReferralInteraction({ modalConfig });

    const blockchainArticleId = useMemo(
        () => keccak256(toHex(articleId)),
        [articleId]
    );

    const { mutateAsync: pushInteraction } = useSendInteraction();

    const { mutate: displayModal } = useDisplayModal({
        mutations: {
            onSuccess: async () => {
                // Since this modal is used to create interaction link, send the event after creation
                const interactionHash = await pushInteraction({
                    interaction: ReferralInteractionEncoder.createLink(),
                });
                console.log(
                    "Referral link creation interaction",
                    interactionHash
                );
            },
        },
    });

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
                console.log("Open interaction delegation id", interactionHash);
            },
        }
    );

    // Trigger the read article event when the user has scrolled to the bottom of the article
    const { targetRef: footerRef } = useIntersectionObserver<HTMLDivElement>({
        threshold: 1,
        oneShot: true,
        onIntersect: async () => {
            console.log("Sending read article interaction");
            const interactionHash = await pushInteraction({
                interaction: PressInteractionEncoder.readArticle({
                    articleId: blockchainArticleId,
                }),
            });
            console.log("Read interaction delegation id", interactionHash);
        },
    });

    // Fetch the article
    const { data: article } = useQuery({
        queryKey: ["news", "full", articleId],
        queryFn: async () => {
            const result = await backendApi.exampleNewsPaper
                .news({ id: articleId })
                .get();
            return result.data;
        },
        enabled: !!articleId,
    });

    if (!article) {
        return <Skeleton count={3} height={100} />;
    }

    return (
        <>
            <Hero isArticle={true} {...article} ref={titleRef} />
            <article className={styles.article}>
                <p className={styles.article__author}>
                    Written by {article.author}
                    <button
                        type={"button"}
                        className={`button ${styles.article__social}`}
                        onClick={() =>
                            displayModal({
                                ...modalConfig,
                                steps: {
                                    ...modalConfig.steps,
                                    success: {
                                        metadata: {
                                            description:
                                                "Get rewarded for sharing this article with your friends",
                                        },
                                        sharing: {
                                            popupTitle:
                                                "Share this article with your friends",
                                            text: `Discover this awesome article from ${article?.author ?? "A Positive World"}!`,
                                            link: window.location.href,
                                        },
                                    },
                                },
                            })
                        }
                    >
                        <Image src={forward} alt="Share" />
                    </button>
                </p>

                <p className={styles.article__summary}>{article.summary}</p>

                <div className={styles.article__markdown}>
                    <Markdown>
                        {article.text.replace("```markdown", "")}
                    </Markdown>
                </div>

                <div ref={footerRef}>&nbsp;</div>
            </article>
        </>
    );
}
