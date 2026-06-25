import type { Stablecoin } from "@frak-labs/app-essentials";

export type MerchantNew = {
    name: string;
    domain: string;
    setupCode: string;
    currency: Stablecoin;
    // Platform-admin only: skip DNS ownership verification and/or link the
    // shared Frak campaign bank. Ignored by the backend for non-admins.
    skipDomainValidation?: boolean;
    useFrakBank?: boolean;
    // Platform-admin only: link this merchant to a TakeAds catalog brand
    // (brand id + base tracking link) so per-user share links can be built.
    takeadsMerchantId?: number;
    takeadsTrackingLink?: string;
};
