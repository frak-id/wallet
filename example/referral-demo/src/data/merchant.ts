import type { Lang } from "@/i18n";
import type { PersonaId } from "./personas";

type Localized = Record<Lang, string>;

export const merchant = {
    name: "Maison Lune",
    domain: "maisonlune.fr",
    instagram: "maisonlune.paris",
    tagline: {
        fr: "Soins essentiels, formulés à Paris.",
        en: "Essential skincare, formulated in Paris.",
    } satisfies Localized,
    /** Shared by the store, the product art and the social posts. */
    palette: {
        paper: "#f6f1ea",
        ink: "#1f1b16",
        muted: "#6f665c",
        line: "#e4dccf",
        accent: "#b4532a",
        accentSoft: "#f1dfd2",
        night: "#1d2340",
    },
    freeShippingFrom: 50,
} as const;

export type ProductId = "serum" | "cream" | "cleanser" | "balm" | "mask";

export type Product = {
    id: ProductId;
    slug: string;
    name: Localized;
    claim: Localized;
    description: Localized;
    size: string;
    price: number;
    rating: number;
    reviews: number;
    badge?: Localized;
};

export const products: Record<ProductId, Product> = {
    serum: {
        id: "serum",
        slug: "serum-eclat",
        name: { fr: "Sérum Éclat", en: "Radiance Serum" },
        claim: {
            fr: "Vitamine C 15 % · Acide férulique",
            en: "15% Vitamin C · Ferulic acid",
        },
        description: {
            fr: "Un sérum concentré qui ravive l'éclat dès la première semaine et lisse visiblement le grain de peau. Texture eau, fini invisible.",
            en: "A concentrated serum that revives radiance from the first week and visibly smooths skin texture. Water-light, invisible finish.",
        },
        size: "30 ml",
        price: 39,
        rating: 4.8,
        reviews: 1284,
        badge: { fr: "Best-seller", en: "Best seller" },
    },
    cream: {
        id: "cream",
        slug: "creme-nuage",
        name: { fr: "Crème Nuage", en: "Cloud Cream" },
        claim: {
            fr: "Hydratation 48 h · Acide hyaluronique",
            en: "48h hydration · Hyaluronic acid",
        },
        description: {
            fr: "Une crème fouettée, légère comme un nuage, qui repulpe et apaise les peaux sensibles.",
            en: "A whipped, cloud-light cream that plumps and soothes sensitive skin.",
        },
        size: "50 ml",
        price: 32,
        rating: 4.7,
        reviews: 982,
    },
    cleanser: {
        id: "cleanser",
        slug: "huile-demaquillante",
        name: { fr: "Huile Démaquillante", en: "Cleansing Oil" },
        claim: {
            fr: "Huile de camélia · Sans parfum",
            en: "Camellia oil · Fragrance free",
        },
        description: {
            fr: "Fond au contact de l'eau en un lait soyeux, emporte maquillage et SPF sans tirailler.",
            en: "Melts into a silky milk with water and lifts makeup and SPF without tightness.",
        },
        size: "150 ml",
        price: 26,
        rating: 4.9,
        reviews: 2041,
        badge: { fr: "Nouveau", en: "New" },
    },
    balm: {
        id: "balm",
        slug: "baume-levres-rosee",
        name: { fr: "Baume Rosée", en: "Dew Lip Balm" },
        claim: {
            fr: "Beurre de karité · Teinte nude",
            en: "Shea butter · Nude tint",
        },
        description: {
            fr: "Nourrit, répare et dépose un voile rosé naturel.",
            en: "Nourishes, repairs and leaves a natural rosy veil.",
        },
        size: "15 ml",
        price: 14,
        rating: 4.6,
        reviews: 611,
    },
    mask: {
        id: "mask",
        slug: "masque-nuit",
        name: { fr: "Masque Nuit", en: "Overnight Mask" },
        claim: { fr: "Rétinal doux · 8 h", en: "Gentle retinal · 8h" },
        description: {
            fr: "Le soin signature de la maison : la peau se régénère pendant votre sommeil.",
            en: "The house signature: skin renews itself while you sleep.",
        },
        size: "50 ml",
        price: 42,
        rating: 4.8,
        reviews: 1530,
    },
};

export const catalog: readonly ProductId[] = [
    "serum",
    "cream",
    "cleanser",
    "mask",
    "balm",
];

/** The product Léa shares and Chloé buys: the thread of the whole demo. */
export const heroProductId: ProductId = "serum";

type OrderLine = { productId: ProductId; quantity: number };

export type Order = {
    number: string;
    lines: readonly OrderLine[];
    shipping: number;
};

export const orders: Record<PersonaId, Order> = {
    lea: {
        number: "20481",
        lines: [
            { productId: "serum", quantity: 1 },
            { productId: "cream", quantity: 1 },
        ],
        shipping: 0,
    },
    chloe: {
        number: "20517",
        lines: [{ productId: "serum", quantity: 1 }],
        shipping: 0,
    },
};

export function orderTotal(order: Order): number {
    return (
        order.lines.reduce(
            (sum, line) => sum + products[line.productId].price * line.quantity,
            0
        ) + order.shipping
    );
}
