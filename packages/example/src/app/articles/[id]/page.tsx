import {getArticle} from "@/context/article/action/get";
import type {Hex} from "viem";
import {ReadArticle} from "@/module/article/component/Read";

export default async function ArticlePage({ params }: { params: { id: string } }) {
    const article = await getArticle(params.id as Hex);
    if (!article) {
        return <h1>Article not found</h1>;
    }

    return (
        <ReadArticle article={article} />
    );
}
