import type { Currency, Language } from "./config";

/**
 * Resolved placement config from backend
 * Translations already flattened: default + lang-specific merged into one record
 * @category Config
 */
export type ResolvedPlacement = {
    trigger?: {
        text?: string;
        noRewardText?: string;
        position?: "bottom-right" | "bottom-left";
        showWallet?: boolean;
    };
    targetInteraction?: string;
    /** Already flattened: default + lang-specific merged into one record */
    translations?: Record<string, string>;
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
    lang: Language;
    css?: string;
    translations?: Record<string, string>;
    placements?: Record<string, ResolvedPlacement>;
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

    /** Merged metadata fields */
    name?: string;
    logoUrl?: string;
    homepageLink?: string;
    lang?: Language;
    currency?: Currency;

    /** Global translations (for reference / component fallback) */
    translations?: Record<string, string>;

    /** Named placements (keyed by placement ID) */
    placements?: Record<string, ResolvedPlacement>;
};
