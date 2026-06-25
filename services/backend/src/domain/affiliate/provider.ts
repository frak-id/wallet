/**
 * Affiliate networks Frak integrates with. Extend this union as new providers
 * are added — every affiliate table carries a `provider` column typed against
 * it, so the persistence layer is provider-agnostic by construction.
 */
export type AffiliateProvider = "takeads";

/**
 * Query-param name each provider reads its sub-id (our attribution token) from
 * on a tracking link. Provider-specific by nature (TakeAds uses `s`, other
 * networks use `clickref`/`subid`/...), so it lives next to the provider union.
 * Extend alongside `AffiliateProvider`.
 */
export const PROVIDER_SUBID_PARAM: Record<AffiliateProvider, string> = {
    takeads: "s",
};
