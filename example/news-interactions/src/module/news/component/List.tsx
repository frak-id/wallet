"use client";

import { getNewsForHome } from "@/context/articles/actions/getNews";
import { Spinner } from "@module/component/Spinner";
import { useQuery } from "@tanstack/react-query";

export function NewsList() {
    const { data: news } = useQuery({
        queryKey: ["news", "list"],
        queryFn: async () => getNewsForHome(),
    });

    if (!news) {
        return <Spinner />;
    }

    return (
        <div>
            <h2>Latest news</h2>
            {news?.latest?.map((news) => (
                // Add a link to the article page
                <div key={news.id}>
                    <h3>{news.title}</h3>
                    <img
                        src={news.image}
                        alt={news.title}
                        style={{ maxWidth: 60 }}
                    />
                    <a href={`/article?id=${news.id}`}>Read more</a>
                </div>
            ))}

            <hr />

            <h2>Quick byte</h2>
            <div>
                <h3>{news?.quickByte?.title}</h3>
                <img
                    src={news?.quickByte?.image}
                    alt={news?.quickByte?.title}
                    style={{ maxWidth: 60 }}
                />
                <a href={`/article?id=${news?.quickByte?.id}`}>Read more</a>
            </div>

            <hr />

            <h2>Featured news</h2>
            {news?.featured?.map((news) => (
                <div key={news.id}>
                    <h3>{news.title}</h3>
                    <img
                        src={news.image}
                        alt={news.title}
                        style={{ maxWidth: 80 }}
                    />
                    <a href={`/article?id=${news.id}`}>Read more</a>
                </div>
            ))}

            <hr />

            <h2>Positive news</h2>
            {news?.positives?.map((news) => (
                <div key={news.id}>
                    <h3>{news.title}</h3>
                    <p>{news.summary}</p>
                    <img
                        src={news.image}
                        alt={news.title}
                        style={{ maxWidth: 80 }}
                    />
                    <a href={`/article?id=${news.id}`}>Read more</a>
                </div>
            ))}

            <hr />

            <footer>
                News provided by{" "}
                <a
                    href={"https://worldnewsapi.com/"}
                    target={"_blank"}
                    rel={"noreferrer"}
                >
                    WorldNewsApi
                </a>
            </footer>
        </div>
    );
}
