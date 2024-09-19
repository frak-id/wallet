/**
 * The keys for each product types
 */
export type ProductTypesKey = keyof typeof productTypes;

/**
 * List of the product types per denominator
 */
export const productTypes = {
    // content type
    dapp: 1,
    press: 2,
    webshop: 3,

    // feature type
    referral: 30,
    purchase: 31,
};

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
