import type { ProductRolesKey } from "@frak-labs/app-essentials";

/**
 * Label and description for the different roles / permissions of a wallet
 */
export const permissionLabels: Record<
    ProductRolesKey,
    { label: string; description: string }
> = {
    productAdministrator: {
        label: "Product administrator",
        description:
            "Product administrator can do anything except transferring or changing product metadata.",
    },
    interactionManager: {
        label: "Interaction manager",
        description:
            "Interaction manager can manage the interaction contract and update it.",
    },
    campaignManager: {
        label: "Campaign manager",
        description:
            "Campaign manager can deploy campaigns, put them on standby, and delete them.",
    },
    purchaseOracleUpdater: {
        label: "Purchase oracle updater",
        description:
            "Purchase oracle updater can update the purchase oracle contract.",
    },
};

/**
 * Array variant of the permissionLabels object
 */
export const permissionLabelsArray: {
    id: ProductRolesKey;
    label: string;
    description: string;
}[] = Object.entries(permissionLabels).map(([id, { label, description }]) => ({
    id: id as ProductRolesKey,
    label,
    description,
}));
