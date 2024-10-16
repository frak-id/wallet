"use client";

import { Skeleton } from "@/module/common/component/Skeleton";
import { useIntersectionObserver } from "@/module/common/hooks/useIntersectionObserver";
import { Hero } from "@/module/news/component/Hero";
import { PressInteractionEncoder } from "@frak-labs/nexus-sdk/interactions";
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

const loginModalStep = {
    metadata: {
        description:
            "Je souhaite percevoir mes gains par **Good Vibes** directement dans mon porte monnaie en partageant ce produit",
        primaryActionText: "Je crée mon porte-monnaie en 30 sec",
        secondaryActionText: "J’ai déja un porte-monnaie",
    },
    allowSso: true,
    ssoMetadata: {
        logoUrl: "https://news-paper.xyz/assets/logo-good-vibes.svg",
        homepageLink: "https://news-paper.xyz/",
    },
} as const;

export function NewsArticle({ articleId }: { articleId: string }) {
    useReferralInteraction({
        modalConfig: {
            steps: {
                login: loginModalStep,
                openSession: {
                    metadata: {
                        description:
                            "Je souhaite recevoir mes gains de **Good Vibes** directement dans mon porte monnaie en partageant ce produit",
                    },
                },
                final: {
                    metadata: {
                        description:
                            "Votre porte-monnaie a été créé pour recevoir votre récompense de **Good Vibes** en cas d’achat.\n" +
                            "Pour retrouver votre porte-monnaie, allez sur [wallet.frak.id](https://wallet.frak.id) ou entrez votre adresse email ci-dessous.",
                    },
                    action: { key: "reward" },
                },
            },
            metadata: {
                lang: "fr",
            },
        },
    });

    const blockchainArticleId = useMemo(
        () => keccak256(toHex(articleId)),
        [articleId]
    );

    const { mutateAsync: pushInteraction } = useSendInteraction();

    const { mutate: displayModal } = useDisplayModal();

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
                        onClick={() => {
                            const finalAction = {
                                key: "sharing",
                                options: {
                                    popupTitle:
                                        "Share this article with your friends",
                                    text: "Discover this awesome article",
                                    link:
                                        typeof window !== "undefined"
                                            ? window.location.href
                                            : "",
                                },
                            } as const;

                            displayModal({
                                metadata: {
                                    lang: "fr",
                                    isDismissible: true,
                                    dismissActionTxt:
                                        "Partager sans être rémunéré(e)",
                                },
                                steps: {
                                    login: loginModalStep,
                                    openSession: {
                                        metadata: {
                                            description:
                                                "Mon porte-monnaie est désormais créé. Cliquez sur le bouton ci-dessous pour l’activer et recevoir vos gains.",
                                        },
                                    },
                                    final: {
                                        metadata: {
                                            description:
                                                "Votre porte-monnaie a été créé pour recevoir votre récompense de **Good Vibes** en cas de partage.\nPour retrouver votre porte-monnaie, allez sur [wallet.frak.id](https://wallet.frak.id) ou entrez votre adresse email ci-dessous.",
                                        },
                                        dismissedMetadata: {
                                            description: "Partager cet article",
                                        },
                                        action: finalAction,
                                    },
                                },
                            });
                        }}
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
