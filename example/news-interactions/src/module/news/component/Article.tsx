import { getNewsById } from "@/context/articles/actions/getNews";
import { usePressReferralInteraction } from "@frak-labs/nexus-sdk/react";
import { Spinner } from "@module/component/Spinner";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";

export function NewsArticleComponent({ articleId }: { articleId: string }) {
    usePressReferralInteraction({});

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

            <img src={article.image} alt={article.title} style={{maxWidth:300}} />

            <Markdown>{article.text.replace("```markdown", "")}</Markdown>
        </div>
    );
}
