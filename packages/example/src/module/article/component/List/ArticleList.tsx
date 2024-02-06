import { getAllArticles } from "@/context/article/action/get";
import Link from "next/link";

export async function ArticleList() {
    const articles = await getAllArticles();

    // List all the articles
    return (
        <ul>
            {articles?.map((article) => (
                <li key={article.id}>
                    <Link href={article.link}>{article.title}</Link>
                </li>
            ))}
        </ul>
    );
}
