import { getNewsById } from "@/context/articles/actions/getNews";
import { useIntersectionObserver } from "@/module/common/hooks/useIntersectionObserver";
import { PressInteractionEncoder } from "@frak-labs/nexus-sdk/interactions";
import { usePressReferralInteraction } from "@frak-labs/nexus-sdk/react";
import { useSendInteraction } from "@frak-labs/nexus-sdk/react";
import { Spinner } from "@module/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import Markdown from "react-markdown";
import { keccak256, toHex } from "viem";

export function NewsArticleComponent({ articleId }: { articleId: string }) {
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
        return <Spinner />;
    }

    return (
        <div>
            <h1 ref={titleRef}>{article.title}</h1>

            <p>{article.summary}</p>

            <img
                src={article.image}
                alt={article.title}
                style={{ maxWidth: 300 }}
            />

            <Markdown>{article.text.replace("```markdown", "")}</Markdown>

            <footer ref={footerRef}>
                News provided by{" "}
                <a
                    href={"https://worldnewsapi.com/"}
                    target={"_blank"}
                    rel={"noreferrer"}
                >
                    WorldNewsApi
                </a>
            </footer>
        </div>
    );
}
