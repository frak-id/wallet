import type { AuthenticatedContext } from "app/types/context";
import { LRUCache } from "lru-cache";
import { backendApi } from "../utils/backendApi";
import { configuredOrigins } from "./frakEnv";
import { levelForStatus, log, setRequestContext } from "./logger";
import {
    buildShareButtonHtml,
    buildShareUrl,
    getBackendUrlMetafield,
    getComponentsUrlMetafield,
    getMerchantIdMetafield,
    getShareButtonHtmlMetafield,
    getShareUrlMetafield,
    getWalletUrlMetafield,
    writeComponentsUrlMetafield,
    writeEnvMetafields,
    writeMerchantIdMetafield,
    writeShareButtonHtmlMetafield,
    writeShareUrlMetafield,
} from "./metafields";
import { shopInfo } from "./shop";

export type MerchantResolveResponse = {
    merchantId: string;
    productId: string;
    name: string;
    domain: string;
};

const merchantIdCache = new LRUCache<string, string>({
    max: 512,
    // Cache for 5 minutes — merchantId rarely changes
    ttl: 5 * 60_000,
});

// Metafield-fallback hits (backend unreachable) are cached only briefly so a
// transient outage doesn't pin a stale value for the full TTL — recovery is
// near-immediate once the backend is reachable again.
const FALLBACK_CACHE_TTL_MS = 30_000;

const merchantInfoCache = new LRUCache<string, MerchantResolveResponse>({
    max: 512,
    ttl: 5 * 60_000,
});

const envSyncedShops = new LRUCache<string, boolean>({
    max: 512,
    ttl: 30 * 60_000,
});

const componentsUrlSyncedShops = new LRUCache<string, boolean>({
    max: 512,
    ttl: 30 * 60_000,
});

const klaviyoShareSyncedShops = new LRUCache<string, boolean>({
    max: 512,
    ttl: 30 * 60_000,
});

/**
 * Resolve the merchantId for the current shop.
 *
 * Resolution order:
 *  1. In-memory LRU cache
 *  2. Frak backend API (by stable normalizedDomain) — the source of truth
 *  3. Shop metafield (frak.merchant_id), only if the backend is UNREACHABLE
 *
 * The metafield is a Liquid-readable mirror of the backend id, not an
 * authority: trusting it first lets a value left over from a previous backend
 * dataset (e.g. a local DB reseed) shadow the real id and fail authorization
 * downstream. So we resolve from the backend and reconcile the metafield,
 * falling back to the last-known metafield value only when the backend can't
 * be reached — never when it authoritatively reports the shop isn't
 * registered (a 404), which would re-introduce the stale-id bug.
 */
export async function resolveMerchantId(
    context: AuthenticatedContext
): Promise<string | null> {
    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;

    // 1. Check LRU cache
    const cached = merchantIdCache.get(cacheKey);
    if (cached) {
        setRequestContext({ merchantId: cached });
        return cached;
    }

    // 2. Resolve from the Frak backend using the stable domain
    const result = await resolveMerchantFromBackend(shop);
    if (result.status === "resolved") {
        const merchantId = result.info.merchantId;
        merchantInfoCache.set(cacheKey, result.info);
        merchantIdCache.set(cacheKey, merchantId);
        setRequestContext({ merchantId });
        syncMerchantIdMetafield(context, merchantId);
        return merchantId;
    }

    // Authoritative "not registered" (404): do NOT fall back to the metafield.
    // A value from a previous backend dataset would shadow reality and 403
    // downstream — exactly the bug this resolution order fixes.
    if (result.status === "not-found") {
        return null;
    }

    // 3. Backend unreachable — fall back to the last-known metafield value so
    //    the app still functions instead of losing the merchant entirely.
    try {
        const metafieldValue = await getMerchantIdMetafield(context);
        if (metafieldValue) {
            merchantIdCache.set(cacheKey, metafieldValue, {
                ttl: FALLBACK_CACHE_TTL_MS,
            });
            setRequestContext({ merchantId: metafieldValue });
            return metafieldValue;
        }
    } catch (error) {
        log.error({ err: error }, "merchantId metafield read failed");
    }

    return null;
}

/**
 * Keep the Liquid-readable `frak.merchant_id` metafield in sync with the
 * backend-resolved id, writing only when it drifted. Fire-and-forget so the
 * request path isn't blocked on a metafield round-trip.
 */
function syncMerchantIdMetafield(
    context: AuthenticatedContext,
    merchantId: string
): void {
    void (async () => {
        try {
            const current = await getMerchantIdMetafield(context);
            if (current === merchantId) {
                return;
            }
            await writeMerchantIdMetafield(context, merchantId);
        } catch (error) {
            log.error({ err: error }, "merchantId metafield sync failed");
        }
    })();
}

/**
 * Resolve the full merchant info for the current shop.
 * Returns name, domain, merchantId, productId.
 */
export async function resolveMerchantInfo(
    context: AuthenticatedContext
): Promise<MerchantResolveResponse | null> {
    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;

    const cached = merchantInfoCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // No metafield fallback here (unlike resolveMerchantId): the mirror stores
    // only the id, not name/productId/domain — so on a backend outage the full
    // info is genuinely unavailable and callers degrade to empty by design.
    const result = await resolveMerchantFromBackend(shop);
    if (result.status !== "resolved") {
        return null;
    }
    const info = result.info;

    merchantInfoCache.set(cacheKey, info);
    // Also populate the id-only cache
    merchantIdCache.set(cacheKey, info.merchantId);

    return info;
}

/**
 * Clear cached merchant data for the current shop.
 * Called after merchant registration so the next resolve fetches fresh data.
 */
export async function clearMerchantCache(
    context: AuthenticatedContext
): Promise<void> {
    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;
    merchantIdCache.delete(cacheKey);
    merchantInfoCache.delete(cacheKey);
}

/**
 * Resolve merchant info from the Frak backend, primary domain first with a
 * myshopify-domain fallback.
 *
 * Custom-domain merchants are registered under their `myshopify.com` identity
 * (the anti-claim hardening — a real custom domain isn't a verifiable
 * subdomain), so a lookup keyed on `primaryDomain.host` (`normalizedDomain`)
 * misses forever. The myshopify domain is the stable identity, so retry on it
 * when the primary-domain lookup comes back empty (C1 / plan §1.1). The
 * backend also aliases the custom domain into `allowedDomains`, so either
 * side of this belt-and-suspenders fix resolves the merchant.
 */
async function resolveMerchantFromBackend(shop: {
    normalizedDomain: string;
    myshopifyDomain: string;
}): Promise<BackendResolveResult> {
    const primary = await fetchMerchantFromBackend(shop.normalizedDomain);
    if (primary.status === "resolved") return primary;
    if (shop.myshopifyDomain === shop.normalizedDomain) return primary;

    const fallback = await fetchMerchantFromBackend(shop.myshopifyDomain);
    if (fallback.status === "resolved") return fallback;

    // Prefer "unreachable" when either lookup couldn't reach the backend, so
    // the caller falls back to the metafield rather than treating a transient
    // outage as an authoritative "not registered".
    return primary.status === "unreachable" || fallback.status === "unreachable"
        ? { status: "unreachable" }
        : { status: "not-found" };
}

/**
 * Outcome of a backend merchant lookup. Distinguishes an authoritative
 * "not registered" (404) from a "couldn't reach the backend" failure so the
 * caller only falls back to the stale metafield mirror on `unreachable`.
 */
type BackendResolveResult =
    | { status: "resolved"; info: MerchantResolveResponse }
    | { status: "not-found" }
    | { status: "unreachable" };

/**
 * Fetch merchant info from the Frak backend by domain.
 */
async function fetchMerchantFromBackend(
    domain: string
): Promise<BackendResolveResult> {
    try {
        const { data, error } = await backendApi.user.merchant.resolve.get({
            query: { domain },
        });
        if (error) {
            // A 404 is the routine, authoritative "merchant not registered
            // yet" case; any other status means the backend answered but
            // failed, treated as unreachable (don't trust it over the
            // metafield).
            log[levelForStatus(error.status)](
                { domain, status: error.status },
                "merchant backend resolve failed"
            );
            return error.status === 404
                ? { status: "not-found" }
                : { status: "unreachable" };
        }

        if (!data) return { status: "not-found" };
        return { status: "resolved", info: data as MerchantResolveResponse };
    } catch (error) {
        log.error({ err: error, domain }, "merchant backend resolve error");
        return { status: "unreachable" };
    }
}

/**
 * Ensure the wallet + backend URL metafields match the current environment. Read, compared and written together so no shop is left with a cross-stage pair.
 * Uses an in-memory cache to avoid redundant GraphQL calls.
 */
export async function ensureEnvMetafields(
    context: AuthenticatedContext
): Promise<void> {
    // Un-defaulted origins: an unconfigured deployment must not stamp production onto every shop it touches.
    const { wallet: expectedWalletUrl, backend: expectedBackendUrl } =
        configuredOrigins();
    if (!expectedWalletUrl || !expectedBackendUrl) return;

    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;

    if (envSyncedShops.get(cacheKey)) return;

    try {
        const [currentWallet, currentBackend] = await Promise.all([
            getWalletUrlMetafield(context),
            getBackendUrlMetafield(context),
        ]);

        if (
            currentWallet !== expectedWalletUrl ||
            currentBackend !== expectedBackendUrl
        ) {
            // Both keys in one mutation: a partial write would leave a cross-stage pair until the next admin visit.
            await writeEnvMetafields(context, {
                walletUrl: expectedWalletUrl,
                backendUrl: expectedBackendUrl,
            });
        }
        // Only on success — a throw above leaves the shop unmarked so the next admin load retries.
        envSyncedShops.set(cacheKey, true);
    } catch (error) {
        log.error({ err: error }, "env metafield sync failed");
    }
}

/**
 * Ensure the components CDN URL metafield matches the current environment.
 * Uses an in-memory cache to avoid redundant GraphQL calls.
 */
export async function ensureComponentsUrlMetafield(
    context: AuthenticatedContext
): Promise<void> {
    const expectedUrl = process.env.FRAK_COMPONENTS_URL ?? "";
    if (!expectedUrl) return;

    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;

    if (componentsUrlSyncedShops.get(cacheKey)) return;

    try {
        const current = await getComponentsUrlMetafield(context);
        if (current === expectedUrl) {
            componentsUrlSyncedShops.set(cacheKey, true);
            return;
        }

        await writeComponentsUrlMetafield(context, expectedUrl);
        componentsUrlSyncedShops.set(cacheKey, true);
    } catch (error) {
        log.error({ err: error }, "componentsUrl metafield sync failed");
    }
}

/**
 * Ensure the Klaviyo share metafields (`frak.share_url` and
 * `frak.share_button_html`) exist and reflect the current primary
 * storefront domain.
 *
 * Merchants reference these from their email-tool templates (Klaviyo,
 * Omnisend …) to drop a ready-to-use share CTA without hard-coding the
 * storefront host — the CTA lands users on the storefront with
 * `?frakAction=share`, which the SDK loader turns into an auto-open
 * sharing page (see
 * `sdk/components/src/bootstrap/initFrakSdk.ts#handleActionQueryParam`).
 *
 * Idempotent and cached per shop for 30 min, same pattern as
 * `ensureEnvMetafields` and `ensureComponentsUrlMetafield`.
 */
export async function ensureKlaviyoShareMetafields(
    context: AuthenticatedContext
): Promise<void> {
    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;

    if (klaviyoShareSyncedShops.get(cacheKey)) return;

    const expectedShareUrl = buildShareUrl(shop.domain);
    const expectedShareButtonHtml = buildShareButtonHtml(shop.domain);

    try {
        const [currentShareUrl, currentShareButtonHtml] = await Promise.all([
            getShareUrlMetafield(context),
            getShareButtonHtmlMetafield(context),
        ]);

        const writes: Promise<unknown>[] = [];
        if (currentShareUrl !== expectedShareUrl) {
            writes.push(writeShareUrlMetafield(context, expectedShareUrl));
        }
        if (currentShareButtonHtml !== expectedShareButtonHtml) {
            writes.push(
                writeShareButtonHtmlMetafield(context, expectedShareButtonHtml)
            );
        }
        if (writes.length > 0) {
            await Promise.all(writes);
        }
        klaviyoShareSyncedShops.set(cacheKey, true);
    } catch (error) {
        log.error({ err: error }, "klaviyoShare metafield sync failed");
    }
}
