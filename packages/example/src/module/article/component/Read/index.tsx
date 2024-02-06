import type { Article } from "@/type/Article";

export function ReadArticle({
    article,
}: {
    article: Article;
}) {
    return (
        <div>
            <h1>Reading Article {article.title}</h1>
            <p>{article.description}</p>

            <button type="button">unlock</button>
        </div>
    );
}
