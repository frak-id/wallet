/**
 * The on-chain roles
 */
export const productRoles = {
    productAdministrator: BigInt(1 << 0),
    interactionManager: BigInt(1 << 1),
    campaignManager: BigInt(1 << 2),
    purchaseOracleUpdater: BigInt(1 << 3),
} as const;

export type ProductRolesKey = keyof typeof productRoles;

/**
 * Role specific for the interaction validator
 */
export const interactionValidatorRoles = BigInt(1 << 2);
