/**
 * Affiliate networks Frak integrates with. Extend this union as new providers
 * are added — every affiliate table carries a `provider` column typed against
 * it, so the persistence layer is provider-agnostic by construction.
 */
export type AffiliateProvider = "takeads";
