import { getNewsById } from "@/context/articles/actions/getNews";
import { testPromptOnNewsText } from "@/context/articles/actions/promptTester";
import { useIntersectionObserver } from "@/module/common/hooks/useIntersectionObserver";
import type { FullNews } from "@/types/News";
import { PressInteractionEncoder } from "@frak-labs/nexus-sdk/interactions";
import { usePressReferralInteraction } from "@frak-labs/nexus-sdk/react";
import { useSendInteraction } from "@frak-labs/nexus-sdk/react";
import { Spinner } from "@module/component/Spinner";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
                <div>
                    Original news from
                    <a href={article.url} target={"_blank"} rel={"noreferrer"}>
                        {new URL(article.url).hostname}
                    </a>
                </div>
                <div>
                    News provided by{" "}
                    <a
                        href={"https://worldnewsapi.com/"}
                        target={"_blank"}
                        rel={"noreferrer"}
                    >
                        WorldNewsApi
                    </a>
                </div>
            </footer>

            <hr />
            <PromptTester article={article} />
        </div>
    );
}

function PromptTester({ article }: { article: FullNews }) {
    const [prompt, setPrompt] = useState<string>("");

    const {
        data: newText,
        status,
        mutate: generate,
    } = useMutation({
        mutationKey: ["prompt", "generate"],
        mutationFn: async () => testPromptOnNewsText({ prompt, news: article }),
    });

    return (
        <>
            <h3>Test formatting prompt</h3>

            <h4>Original text</h4>
            <code>{article.originalText}</code>

            <h4>Prompt</h4>
            <p>The original text will be added at the end of the prompt</p>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
            />
            <button
                type={"button"}
                onClick={() => {
                    console.log("Prompt", prompt);
                    generate();
                }}
            >
                Submit prompt
            </button>

            <hr/>

            <h4>Result</h4>
            <p>Generation status {status}</p>
            <code>{newText}</code>

            <h4>Formatted result text</h4>
            <Markdown>{newText}</Markdown>
        </>
    );
}
