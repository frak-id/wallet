"use client";

import { getNewsForHome } from "@/context/articles/actions/getNews";
import { Skeleton } from "@/module/common/component/Skeleton";
import { Swiper } from "@/module/common/component/Swiper";
import { Hero } from "@/module/news/component/Hero";
import { HighlightTitle } from "@/module/news/component/HighlightTitle";
import { List } from "@/module/news/component/List";
import { QuickBites } from "@/module/news/component/QuickBites";
import { Title } from "@/module/news/component/Title";
import { useQuery } from "@tanstack/react-query";

export function NewsList() {
    const { data: news, isPending } = useQuery({
        queryKey: ["news", "list"],
        queryFn: async () => getNewsForHome(),
    });

    if (!news || isPending) {
        return <Skeleton count={3} height={100} />;
    }

    return (
        <>
            <Hero {...news.hero} />

            <Title>Top stories</Title>
            <List>
                {news?.latest?.map((news) => (
                    <List.Item key={news.id} news={news} top={true} />
                ))}
            </List>

            <Title>Quick bites</Title>
            <QuickBites {...news?.quickByte} />

            <HighlightTitle>Featured news</HighlightTitle>
            <Swiper featured={news?.featured} />

            <HighlightTitle>Positive news</HighlightTitle>
            <List>
                {news?.positives?.map((news) => (
                    <List.Item key={news.id} news={news} />
                ))}
            </List>
        </>
    );
}
