import { getArticle } from "@/context/article/action/get";
import { ReadArticle } from "@/module/article/component/Read";
import type { Hex } from "viem";

export default async function ArticlePage({
    params,
}: { params: { id: string } }) {
    const article = await getArticle(params.id as Hex);
    if (!article) {
        return <h1>Article not found</h1>;
    }

    return <ReadArticle article={article} />;
}
