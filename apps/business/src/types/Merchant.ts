import type { Stablecoin } from "@frak-labs/app-essentials";

export type MerchantNew = {
    name: string;
    domain: string;
    setupCode: string;
    currency: Stablecoin;
};
