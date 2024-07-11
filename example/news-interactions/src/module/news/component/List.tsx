"use client";

import { getLatestNews } from "@/context/articles/actions/getNews";
import { useQuery } from "@tanstack/react-query";

export function NewsList() {
    const { data: news } = useQuery({
        queryKey: ["news", "list"],
        queryFn: async () => {
            return getLatestNews({ limit: 10, offset: 0 });
        },
    });

    return (
        <div>
            {news?.map((news) => (
                <div key={news.id}>
                    <h2>{news.title}</h2>
                    <p>{news.summary}</p>
                    <img
                        src={news.image}
                        alt={news.title}
                        style={{ maxWidth: 120 }}
                    />
                </div>
            ))}
        </div>
    );
}
