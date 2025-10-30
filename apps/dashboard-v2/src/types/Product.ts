import type { Stablecoin } from "@frak-labs/app-essentials";
import type { ProductTypesKey } from "@frak-labs/core-sdk";

export type ProductNew = {
    name: string;
    domain: string;
    productTypes: ProductTypesKey[];
    setupCode: string;
    currency: Stablecoin;
};
