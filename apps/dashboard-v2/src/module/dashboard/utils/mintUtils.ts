import type { Stablecoin } from "@frak-labs/app-essentials";
import type { ProductTypesKey } from "@frak-labs/core-sdk";

// Get default currency based on browser language
export function getDefaultStablecoin(): Stablecoin {
    if (typeof navigator === "undefined") return "eure";

    const language = navigator.language.toLowerCase();
    if (language.startsWith("en-us")) return "usde";
    if (language.startsWith("en-gb")) return "gbpe";
    return "eure"; // Default fallback
}

// Default selected product types
export const defaultProductTypes: ProductTypesKey[] = [
    "referral",
    "purchase",
    "webshop",
];

// Product type descriptions with detailed explanations and trackable events
export const productTypeDescriptions: Record<
    ProductTypesKey,
    { name: string; description: string; useCase: string; events: string[] }
> = {
    referral: {
        name: "Referral",
        description: "Allow campaigns to track user referral events",
        useCase: "Great to reward users sharing to other users",
        events: ["Referred", "Create Link"],
    },
    purchase: {
        name: "Purchase",
        description: "Allow campaigns to track user purchases",
        useCase: "Great to reward based on purchase activity",
        events: ["Purchase Started", "Purchase Completed"],
    },
    webshop: {
        name: "WebShop",
        description: "Allow tracking of webshop related events",
        useCase: "Track add to cart, product views, and shopping behavior",
        events: ["Visit"],
    },
    retail: {
        name: "Retail",
        description: "Allow tracking of physical retail events",
        useCase:
            "Track in-person purchases and reward offline activity (requires further implementation)",
        events: ["Customer Meetup"],
    },
    press: {
        name: "Press",
        description: "Allow tracking of news/press related content",
        useCase:
            "Track when users open blog posts, read articles to completion",
        events: ["Open Article", "Read Article"],
    },
    dapp: {
        name: "DApp",
        description: "Allow tracking of blockchain related events",
        useCase: "Track user swaps, DeFi interactions, and on-chain activity",
        events: ["Onchain Storage Update", "Onchain Proof Verification"],
    },
};
