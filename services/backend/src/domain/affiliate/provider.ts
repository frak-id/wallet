/**
 * Affiliate networks Frak integrates with. Extend this union as new providers
 * are added — every affiliate table carries a `provider` column typed against
 * it.
 */
export type AffiliateProvider = "takeads";
