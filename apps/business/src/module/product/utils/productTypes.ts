/**
 * List of the product types per denominator
 */
const productTypes = {
    // content type
    dapp: 1,
    press: 2,
    webshop: 3,
    retail: 4,

    // feature type
    referral: 30,
    purchase: 31,
} as const;

/**
 * The keys for each product types
 */
export type ProductTypesKey = keyof typeof productTypes;

/**
 * Bitmask for each product types
 */
export const productTypesMask: Record<ProductTypesKey, bigint> = Object.entries(
    productTypes
).reduce(
    (acc, [key, value]) => {
        acc[key as ProductTypesKey] = BigInt(1) << BigInt(value);
        return acc;
    },
    {} as Record<ProductTypesKey, bigint>
);

/**
 * Decode a bit mask of product types into an array of keys contained inside it
 * @param mask
 */
export function decodeProductTypesMask(mask: bigint): ProductTypesKey[] {
    return Object.entries(productTypesMask).reduce(
        (acc, [itemKey, itemMask]) => {
            if ((mask & itemMask) === itemMask) {
                acc.push(itemKey as ProductTypesKey);
            }
            return acc;
        },
        [] as ProductTypesKey[]
    );
}

/**
 * Encode an array of product types keys into a bit mask
 */
export function encodeProductTypesMask(types: ProductTypesKey[]): bigint {
    return types.reduce((acc, type) => acc | productTypesMask[type], 0n);
}

/**
 * The keys for each product types
 */
export const productTypesLabel: Record<
    ProductTypesKey,
    {
        name: string;
        description: string;
    }
> = {
    dapp: {
        name: "Dapp",
        description: "Monitor blockchain-based application interactions.",
    },
    press: {
        name: "Press",
        description: "Track reader engagement with articles and content.",
    },
    webshop: {
        name: "WebShop",
        description:
            "Track user engagement with product view and basket actions.",
    },
    retail: {
        name: "Retail",
        description: "Track user engagement in retail.",
    },
    referral: {
        name: "Referral",
        description: "Enable and measure user referral activities.",
    },
    purchase: {
        name: "Purchase",
        description: "Enable purchase tracking.",
    },
};
