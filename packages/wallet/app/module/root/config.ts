import { nProgressStylesUrl } from "@/module/common/component/TopLoader";
import allCssUrl from "@/styles/all.css?url";
import { isRunningInProd } from "@frak-labs/app-essentials";
import type { LinksFunction, MetaFunction } from "react-router";

const meta: MetaFunction = () => {
    return [
        { title: "Frak Wallet | Your Web3 Identity & Reward Hub" },
        { name: "application-name", content: "Frak Wallet" },
        {
            name: "description",
            content:
                "Frak Wallet: Your passkey-first smart wallet for a unified web identity. Earn rewards through website interactions, seamlessly integrate with partner sites, and manage your digital assets securely.",
        },
        {
            name: "author",
            content: "Frak labs",
        },
        {
            name: "author",
            content: "Rodolphe Stoclin",
        },
        {
            name: "author",
            content: "Quentin Nivelais",
        },
        {
            name: "creator",
            content: "Frak labs",
        },
        {
            name: "publisher",
            content: "Frak labs",
        },
        {
            name: "theme-color",
            content: "#001432",
        },
        {
            name: "keywords",
            content:
                "frak, frak-wallet, blockchain wallet, smart wallet, web3 identity, passkey, digital rewards ,user engagement",
        },
        {
            property: "og:type",
            content: "website",
        },
        {
            property: "og:url",
            content: isRunningInProd
                ? "https://wallet.frak.id"
                : "https://wallet-dev.frak.id",
        },
        {
            property: "og:title",
            content: "Frak Wallet | Your Web3 Identity & Reward Hub",
        },
        {
            property: "og:description",
            content:
                "Manage your unified web identity, earn rewards, and interact seamlessly with partner websites using our passkey-first blockchain smart wallet.",
        },
        {
            property: "og:site_name",
            content: "Frak Wallet",
        },
        {
            name: "twitter:card",
            content: "summary_large_image",
        },
        { name: "twitter:site", content: "@frak_defi" },
        {
            name: "twitter:title",
            content: "Frak Wallet | Your Web3 Identity & Reward Hub",
        },
        {
            name: "twitter:description",
            content:
                "Manage your unified web identity, earn rewards, and interact seamlessly with partner websites using our passkey-first blockchain smart wallet.",
        },
        {
            name: "mobile-web-app-capable",
            content: "yes",
        },
        {
            name: "apple-mobile-web-app-title",
            content: "Frak Wallet",
        },
        {
            name: "apple-mobile-web-app-status-bar-style",
            content: "default",
        },
        {
            name: "google",
            content: "notranslate",
        },
    ];
};

const links: LinksFunction = () => [
    {
        rel: "icon",
        href: "/favicon.ico",
        sizes: "32x32",
    },
    {
        rel: "icon",
        href: "/icon.svg",
        type: "image/svg+xml",
    },
    {
        rel: "apple-touch-icon",
        href: "/icon-192.png",
        type: "image/png",
    },
    {
        rel: "manifest",
        href: "/manifest.json",
        crossOrigin: "use-credentials",
    },
    {
        rel: "author",
        href: "https://frak.id/",
    },
    {
        rel: "author",
        href: "https://github.com/srod",
    },
    {
        rel: "author",
        href: "https://github.com/KONFeature",
    },
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
    { rel: "stylesheet", href: nProgressStylesUrl },
];

export const rootConfig = {
    meta,
    links,
};
