import {
    buildShareLinkUrl,
    type ShareLinkPayload,
} from "@frak-labs/components/shareLink";
import type { AuthenticatedContext } from "app/types/context";
import { LRUCache } from "lru-cache";
import { shopInfo } from "./shop";

const FRAK_NAMESPACE = "frak";
const SHARE_URL_KEY = "share_url";
const SHARE_URL_TYPE = "single_line_text_field";

// 30min TTL — `metafieldDefinitionCreate` is idempotent but every webhook fire
// would otherwise trigger a redundant GraphQL roundtrip.
const definitionEnsuredShops = new LRUCache<string, boolean>({
    max: 512,
    ttl: 30 * 60_000,
});


type CustomerShareUrlContext = Pick<AuthenticatedContext, "admin" | "session">;

/**
 * Ensure the `frak.share_url` customer metafield definition exists.
 *
 * Idempotent: a TAKEN error response means the definition already exists,
 * which we treat as success. The definition needs `MERCHANT_READ` admin
 * access for Shopify Notifications Liquid templates, and `PUBLIC_READ`
 * storefront access so Klaviyo's native sync can pick it up as a profile
 * property.
 */
export async function ensureCustomerShareUrlDefinition(
    ctx: CustomerShareUrlContext
): Promise<void> {
    const shop = await shopInfo(ctx as AuthenticatedContext);
    const cacheKey = shop.normalizedDomain;

    if (definitionEnsuredShops.get(cacheKey)) return;

    try {
        const response = await ctx.admin.graphql(
            `#graphql
            mutation FrakCreateCustomerShareUrlDefinition(
                $definition: MetafieldDefinitionInput!
            ) {
                metafieldDefinitionCreate(definition: $definition) {
                    createdDefinition { id }
                    userErrors { field message code }
                }
            }`,
            {
                variables: {
                    definition: {
                        namespace: FRAK_NAMESPACE,
                        key: SHARE_URL_KEY,
                        type: SHARE_URL_TYPE,
                        ownerType: "CUSTOMER",
                        name: "Frak share URL",
                        description:
                            "Per-customer URL that opens the Frak sharing modal when clicked. Use it in post-purchase emails and marketing flows.",
                        pin: true,
                        access: {
                            admin: "MERCHANT_READ",
                            storefront: "PUBLIC_READ",
                        },
                    },
                },
            }
        );

        const {
            data: { metafieldDefinitionCreate },
        } = await response.json();

        const errors = metafieldDefinitionCreate?.userErrors ?? [];
        const onlyTaken = errors.every(
            (e: { code?: string }) => e.code === "TAKEN"
        );

        if (errors.length === 0 || onlyTaken) {
            definitionEnsuredShops.set(cacheKey, true);
            return;
        }

        console.warn(
            "[Frak] customer share_url metafield definition errors",
            errors
        );
    } catch (error) {
        console.error(
            "[Frak] failed to ensure customer share_url definition",
            error
        );
    }
}


export async function mintCustomerShareUrl(
    ctx: CustomerShareUrlContext,
    {
        products,
    }: {
        products?: ShareLinkPayload["products"];
    } = {}
): Promise<string> {
    const shop = await shopInfo(ctx as AuthenticatedContext);
    const baseUrl = shop.primaryDomain?.url ?? shop.url;

    return buildShareLinkUrl({
        baseUrl,
        payload: {
            link: baseUrl,
            targetInteraction: "create_referral_link",
            ...(products?.length ? { products } : {}),
        },
    });
}


export async function writeCustomerShareUrl(
    ctx: CustomerShareUrlContext,
    {
        customerGid,
        shareUrl,
    }: {
        customerGid: string;
        shareUrl: string;
    }
): Promise<{
    success: boolean;
    userErrors: Array<{ field: string; message: string }>;
}> {
    const response = await ctx.admin.graphql(
        `#graphql
        mutation FrakSetCustomerShareUrl($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
                metafields { id }
                userErrors { field message }
            }
        }`,
        {
            variables: {
                metafields: [
                    {
                        namespace: FRAK_NAMESPACE,
                        key: SHARE_URL_KEY,
                        type: SHARE_URL_TYPE,
                        value: shareUrl,
                        ownerId: customerGid,
                    },
                ],
            },
        }
    );

    const {
        data: { metafieldsSet },
    } = await response.json();

    return {
        success: (metafieldsSet?.userErrors?.length ?? 0) === 0,
        userErrors: metafieldsSet?.userErrors ?? [],
    };
}

export type LineItemForSharing = {
    /** Shopify GraphQL ID for the product, e.g. `gid://shopify/Product/123`. */
    productGid: string;
    /** Product title surfaced in the sharing modal. */
    title: string;
};

/**
 * Failures are logged and swallowed — a failed metafield write must never
 * block order processing.
 */
export async function mintAndStoreCustomerShareUrl(
    ctx: CustomerShareUrlContext,
    {
        customerGid,
        lineItems,
    }: {
        customerGid: string;
        lineItems?: LineItemForSharing[];
    }
): Promise<void> {
    try {
        await ensureCustomerShareUrlDefinition(ctx);
        const products = await enrichLineItemsForSharing(ctx, lineItems);
        const shareUrl = await mintCustomerShareUrl(ctx, { products });
        const result = await writeCustomerShareUrl(ctx, {
            customerGid,
            shareUrl,
        });

        if (!result.success) {
            console.warn(
                "[Frak] customer share_url metafield write returned errors",
                result.userErrors
            );
        }
    } catch (error) {
        console.error("[Frak] mintAndStoreCustomerShareUrl failed", error);
    }
}

/**
 * Build the `products` array surfaced in the sharing modal from the order's
 * line items. Only the first item is used to keep the URL compact — a single
 * featured product also produces a more focused share UX than a long list.
 */
async function enrichLineItemsForSharing(
    ctx: CustomerShareUrlContext,
    lineItems: LineItemForSharing[] | undefined
): Promise<ShareLinkPayload["products"] | undefined> {
    const first = lineItems?.[0];
    if (!first) return undefined;

    const enrichment = await fetchProductForSharing(ctx, first.productGid);
    if (!enrichment) {
        return [{ title: first.title }];
    }

    const shop = await shopInfo(ctx as AuthenticatedContext);
    const baseUrl = (shop.primaryDomain?.url ?? shop.url).replace(/\/$/, "");

    return [
        {
            title: first.title,
            ...(enrichment.imageUrl ? { imageUrl: enrichment.imageUrl } : {}),
            ...(enrichment.handle
                ? { link: `${baseUrl}/products/${enrichment.handle}` }
                : {}),
        },
    ];
}

async function fetchProductForSharing(
    ctx: CustomerShareUrlContext,
    productGid: string
): Promise<{ handle: string; imageUrl?: string } | null> {
    try {
        const response = await ctx.admin.graphql(
            `#graphql
            query FrakGetProductForSharing($id: ID!) {
                product(id: $id) {
                    handle
                    featuredImage { url }
                }
            }`,
            { variables: { id: productGid } }
        );
        const {
            data: { product },
        } = await response.json();
        if (!product?.handle) return null;
        return {
            handle: product.handle,
            imageUrl: product.featuredImage?.url ?? undefined,
        };
    } catch (error) {
        console.warn("[Frak] failed to fetch product for sharing", error);
        return null;
    }
}
