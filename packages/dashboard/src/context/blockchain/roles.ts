/**
 * The on-chain roles
 */
export const roles = {
    productManager: BigInt(1 << 2),
    campaignManager: BigInt(1 << 3),
} as const;

export type RolesKeys = keyof typeof roles;
