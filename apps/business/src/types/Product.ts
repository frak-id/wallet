import type { Stablecoin } from "@frak-labs/app-essentials";
import type { ProductTypesKey } from "@/module/product/utils/productTypes";

export type ProductNew = {
    name: string;
    domain: string;
    productTypes: ProductTypesKey[];
    setupCode: string;
    currency: Stablecoin;
};
