import type { AuthenticatedContext } from "app/types/context";
import { LRUCache } from "lru-cache";
import { log, setRequestContext } from "./logger";

const CURRENCY_MAP: Record<string, "usd" | "eur" | "gbp"> = {
    USD: "usd",
    EUR: "eur",
    GBP: "gbp",
};

/**
 * Normalize a shop domain by stripping protocol and www prefix.
 */
export function normalizeDomain(
    primaryDomainHost: string | undefined,
    myshopifyDomain: string
): string {
    const finalDomain = primaryDomainHost ?? myshopifyDomain;
    return finalDomain
        .replace("https://", "")
        .replace("http://", "")
        .replace("www.", "");
}

/**
 * Normalize a currency code to a supported lowercase value.
 * Falls back to "eur" for unsupported currencies.
 */
export function normalizePreferredCurrency(
    currencyCode: string | undefined
): "usd" | "eur" | "gbp" {
    return CURRENCY_MAP[currencyCode ?? "EUR"] ?? "eur";
}

type ShopInfoReturnType = {
    id: string;
    name: string;
    url: string;
    myshopifyDomain: string;
    primaryDomain: {
        id: string;
        host: string;
        url: string;
    };
    domain: string;
    normalizedDomain: string;
    preferredCurrency: "usd" | "eur" | "gbp";
};

const shopInfoCache = new LRUCache<string, ShopInfoReturnType>({
    max: 512,
    // ttl of 1min
    ttl: 60_000,
});

/**
 * Get the shop name and url
 */
export async function shopInfo({
    admin: { graphql },
    session: { shop: sessionShop },
}: AuthenticatedContext): Promise<ShopInfoReturnType> {
    // Enrich the per-request log context so every downstream line carries the
    // shop, then serve from the LRU cache when possible.
    setRequestContext({ shop: sessionShop });
    const cachedShopInfo = shopInfoCache.get(sessionShop);
    if (cachedShopInfo) {
        log.debug({ shop: sessionShop }, "shop info cache hit");
        return cachedShopInfo;
    }
    log.debug({ shop: sessionShop }, "shop info cache miss");
    // Otherwise, fetch it from the API
    const response = await graphql(`
    query shopInfo {
      shop {
        id
        name
        url
        myshopifyDomain
        primaryDomain {
          id
          host
          url
        }
        currencyCode
      }
    }
  `);
    const {
        data: { shop },
    } = await response.json();

    // Normalize domain and currency
    const normalizedDomain = normalizeDomain(
        shop.primaryDomain?.host,
        shop.myshopifyDomain
    );
    const preferredCurrency = normalizePreferredCurrency(shop.currencyCode);

    // Build our final object
    const finalShopInfo = {
        ...shop,
        domain: shop.primaryDomain?.host ?? shop.myshopifyDomain,
        normalizedDomain,
        preferredCurrency,
    };

    // Add it to our LRU Cache
    shopInfoCache.set(sessionShop, finalShopInfo);

    return finalShopInfo;
}

export type FirstProductPublishedReturnType = {
    handle: string;
};

/**
 * Get the first product published
 */
export async function firstProductPublished({
    admin: { graphql },
}: AuthenticatedContext): Promise<FirstProductPublishedReturnType> {
    const response = await graphql(`
    query GetFirstPublishedProduct {
      products(first: 1, query: "published_status:published") {
        edges {
          node {
            handle
          }
        }
      }
    }
  `);
    const {
        data: { products },
    } = await response.json();

    return products.edges?.[0]?.node;
}
