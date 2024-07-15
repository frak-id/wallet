"use client";

import { getNewsForHome } from "@/context/articles/actions/getNews";
import { HighlightTitle } from "@/module/news/component/HighlightTitle";
import { List } from "@/module/news/component/List";
import { QuickBites } from "@/module/news/component/QuickBites";
import { Title } from "@/module/news/component/Title";
import { Skeleton } from "@module/component/Skeleton";
import { useQuery } from "@tanstack/react-query";

export function NewsList() {
    const { data: news } = useQuery({
        queryKey: ["news", "list"],
        queryFn: async () => getNewsForHome(),
    });

    if (!news) {
        return <Skeleton count={3} height={100} />;
    }

    return (
        <>
            <Title>Top stories</Title>
            <List>
                {news?.latest?.map((news) => (
                    <List.Item key={news.id} news={news} top={true} />
                ))}
            </List>

            <Title>Quick bites</Title>
            <QuickBites {...news?.quickByte} />

            <HighlightTitle>Featured news</HighlightTitle>
            <List>
                {news?.featured?.map((news) => (
                    <List.Item key={news.id} news={news} />
                ))}
            </List>

            <HighlightTitle>Positive news</HighlightTitle>
            <List>
                {news?.positives?.map((news) => (
                    <List.Item key={news.id} news={news} />
                ))}
            </List>
        </>
    );
}
