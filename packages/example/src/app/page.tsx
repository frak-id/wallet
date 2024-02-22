import { ArticleList } from "@/module/article/component/List/ArticleList";

export default function HomePage() {
    return (
        <div>
            <h1>Example interaction with Frak wallet</h1>
            <p>
                Welcome to the Frak Wallet example. This is a simple example
                showcasing the possible interaction with the Frak wallet.
            </p>

            <br />
            <br />

            <p>Explore a few of our articles</p>

            <ArticleList />
        </div>
    );
}
