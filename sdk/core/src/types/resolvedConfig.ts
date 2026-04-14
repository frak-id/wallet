import type { Currency, Language } from "./config";

/**
 * Response from the merchant resolve endpoint
 * @category Config
 */
export type MerchantConfigResponse = {
    merchantId: string;
    name: string;
    domain: string;
    allowedDomains: string[];
    sdkConfig?: ResolvedSdkConfig;
};

/**
 * Resolved placement config from backend
 * Translations already flattened: default + lang-specific merged into one record
 * @category Config
 */
export type ResolvedPlacement = {
    /** Per-component configuration within this placement */
    components?: {
        buttonShare?: {
            text?: string;
            noRewardText?: string;
            clickAction?: "embedded-wallet" | "share-modal" | "sharing-page";
            useReward?: boolean;
            css?: string;
        };
        buttonWallet?: {
            position?: "right" | "left";
            css?: string;
        };
        openInApp?: {
            text?: string;
            css?: string;
        };
        postPurchase?: {
            badgeText?: string;
            refereeText?: string;
            refereeNoRewardText?: string;
            referrerText?: string;
            referrerNoRewardText?: string;
            ctaText?: string;
            ctaNoRewardText?: string;
            css?: string;
        };
        banner?: {
            referralTitle?: string;
            referralDescription?: string;
            referralCta?: string;
            inappTitle?: string;
            inappDescription?: string;
            inappCta?: string;
            css?: string;
        };
    };
    targetInteraction?: string;
    /** Already flattened: default + lang-specific merged into one record */
    translations?: Record<string, string>;
    /** Global placement CSS (applied to modals/listener) */
    css?: string;
};

/**
 * Resolved SDK config from backend `/resolve` endpoint
 * Language resolution and translation merging already applied
 * @category Config
 */
export type ResolvedSdkConfig = {
    name?: string;
    logoUrl?: string;
    homepageLink?: string;
    currency?: Currency;
    lang?: Language;
    /** When true, all SDK components should be hidden */
    hidden?: boolean;
    css?: string;
    translations?: Record<string, string>;
    placements?: Record<string, ResolvedPlacement>;
    /** Global component defaults (used when no placement override exists) */
    components?: ResolvedPlacement["components"];
};

/**
 * Internal SDK config store state
 * Merged config: backend > SDK static > defaults
 * Components subscribe to this reactively
 * @category Config
 */
export type SdkResolvedConfig = {
    /** Whether the backend config has been resolved */
    isResolved: boolean;

    /** Merchant ID from resolution */
    merchantId: string;

    /** Domain returned by the resolve endpoint */
    domain?: string;

    /** Domains allowed for this merchant (used by iframe trust check) */
    allowedDomains?: string[];

    /** Whether the resolve returned a backend sdkConfig object */
    hasRawSdkConfig?: boolean;

    /** Merged metadata fields */
    name?: string;
    logoUrl?: string;
    homepageLink?: string;
    lang?: Language;
    currency?: Currency;

    /** When true, all SDK components should be hidden */
    hidden?: boolean;

    /** Global CSS from backend config (passed to iframe) */
    css?: string;

    /** Global translations (for reference / component fallback) */
    translations?: Record<string, string>;

    /** Named placements (keyed by placement ID) */
    placements?: Record<string, ResolvedPlacement>;

    /** Global component defaults (fallback for placement-level overrides) */
    components?: ResolvedPlacement["components"];
};
