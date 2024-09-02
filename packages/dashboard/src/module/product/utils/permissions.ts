import type { RolesKeys } from "@/context/blockchain/roles";

/**
 * Label and description for the different roles / permissions of a wallet
 */
export const permissionLabels: Record<
    RolesKeys,
    { label: string; description: string }
> = {
    productManager: {
        label: "Product manager",
        description:
            "Product manager can manage the interaction contract and update it.",
    },
    campaignManager: {
        label: "Campaign manager",
        description:
            "Campaign manager can deploy campaigns, put them on standby, and delete them.",
    },
};

/**
 * Array variant of the permissionLabels object
 */
export const permissionLabelsArray: {
    id: RolesKeys;
    label: string;
    description: string;
}[] = Object.entries(permissionLabels).map(([id, { label, description }]) => ({
    id: id as RolesKeys,
    label,
    description,
}));
