import { ArticleList } from "@/module/article/component/List/ArticleList";

export default async function ArticlePage() {
    return (
        <div>
            <h1>Welcome to the articles page</h1>
            <ArticleList />
        </div>
    );
}
