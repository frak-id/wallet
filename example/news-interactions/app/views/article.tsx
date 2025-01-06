import { NewsArticle } from "@/module/news/component/NewsArticle";
import { useSearchParams } from "react-router";

export default function Article() {
    const [searchParams] = useSearchParams();
    const articleId = searchParams.get("id");

    if (!articleId) {
        // Invalid article
        return <h1>Invalid article</h1>;
    }

    return <NewsArticle articleId={articleId} />;
}
