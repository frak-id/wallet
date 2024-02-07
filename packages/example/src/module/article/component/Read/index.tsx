import type { Article } from "@/type/Article";
import Link from "next/link";

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

            <br />

            <Link href={`${process.env.FRAK_WALLET_URL}/paywall`}>
                Unlock with FRK
            </Link>
        </div>
    );
}
