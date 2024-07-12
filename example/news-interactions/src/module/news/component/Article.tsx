import { getNewsById } from "@/context/articles/actions/getNews";
import { usePressReferralInteraction } from "@frak-labs/nexus-sdk/react";
import { Spinner } from "@module/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import { keccak256, toHex } from "viem";

export function NewsArticleComponent({ articleId }: { articleId: string }) {
    usePressReferralInteraction({
        contentId: keccak256(toHex("news-paper.xyz")),
    });

    const { data: article } = useQuery({
        queryKey: ["news", "full", articleId],
        queryFn: async () => {
            return getNewsById(articleId);
        },
        enabled: !!articleId,
    });

    if (!article) {
        return <Spinner />;
    }

    return (
        <div>
            <h1>{article.title}</h1>
            <p>{article.summary}</p>
            <img src={article.image} alt={article.title} />
            <p>{article.text}</p>
        </div>
    );
}
