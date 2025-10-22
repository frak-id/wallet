import type { LinksFunction, MetaFunction } from "react-router";
import allCssUrl from "@/styles/all.css?url";

const meta: MetaFunction = () => {
    return [
        { title: "Frak Listener" },
        { name: "application-name", content: "Frak Listener" },
        {
            name: "description",
            content: "Frak Listener - iframe component for wallet interactions",
        },
    ];
};

const links: LinksFunction = () => [
    { rel: "preconnect", href: "https://fonts.googleapis.com" },
    {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
    },
    {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Sora:wght@100..800&display=swap",
    },
    {
        rel: "stylesheet",
        href: allCssUrl,
    },
];

export const rootConfig = {
    meta,
    links,
};
