import { Header } from "@/module/common/component/Header";
import { Hero } from "@/module/common/component/Hero";
import { NewsList } from "@/module/news/component/NewsList";

export default function HomePage() {
    return (
        <>
            <Header />
            <Hero />
            <NewsList />
        </>
    );
}
