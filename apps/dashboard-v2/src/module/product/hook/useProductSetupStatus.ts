import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { demoModeStore } from "@/stores/demoModeStore";
import { useGetProductAdministrators } from "./useGetProductAdministrators";
import { useGetProductFunding } from "./useGetProductFunding";

type SetupStatusItemKey =
    | "other-admin"
    | "interaction-setup"
    | "delegated-interaction"
    | "oracle-updater-allowed"
    | "webhook-setup"
    | "add-funding"
    | "running-bank"
    | "add-campaign";

export type ProductSetupStatusItem = {
    key: SetupStatusItemKey;
    name: string;
    description: string;
    isGood: boolean;
    documentationLink?: string;
    resolvingPage: string;
};

export type ProductSetupStatus = {
    items: ProductSetupStatusItem[];
    hasWarning: boolean;
};

/**
 * Base steps info with all setup requirements
 */
const BASE_STEPS: Record<
    SetupStatusItemKey,
    Omit<ProductSetupStatusItem, "isGood">
> = {
    "other-admin": {
        key: "other-admin",
        name: "Add an Additional Admin",
        description:
            "Enhance your product's security and manageability by adding another admin. This will help ensure multiple team members can oversee the product's settings, campaigns, and integrations, maintaining continuity and strengthening access control.",
        documentationLink:
            "https://docs.frak.id/business/product/config/team#adding-a-new-member",
        resolvingPage: "/product/[productId]/team",
    },
    "interaction-setup": {
        key: "interaction-setup",
        name: "Create Interaction/CRM Event Contract",
        description:
            "Deploy an on-chain CRM event contract to enable this product to record and manage interactions securely on the blockchain. This setup allows you to capture real-time user engagement data, facilitating insights for targeted campaigns and rewards.",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#interactionSettings",
    },
    "delegated-interaction": {
        key: "delegated-interaction",
        name: "Authorize Interaction/CRM Validator",
        description:
            "Grant Frak the ability to log and manage interactions on your behalf, simplifying the process of tracking engagement for this product. By authorizing Frak as an Interaction/CRM validator, you'll streamline data management for your campaigns.",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#interactionSettings",
    },
    "oracle-updater-allowed": {
        key: "oracle-updater-allowed",
        name: "Authorize Purchase Validation",
        description:
            "Enable Frak to validate each purchase made by users on the blockchain. By authorizing purchase validation, you can automate reward distribution and ensure secure, tamper-proof tracking of user transactions for your product.",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#purchaseTracker",
    },
    "webhook-setup": {
        key: "webhook-setup",
        name: "Setup Purchase Webhook",
        description:
            "Configure a webhook between your purchase platform and Frak to seamlessly relay purchase events. This setup lets Frak validate purchases and initiate rewards, ensuring a smooth experience for your users when they make qualifying purchases.",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#purchaseTracker",
    },
    "add-funding": {
        key: "add-funding",
        name: "Add Product Funding",
        description:
            "Fund your product to activate campaigns and provide rewards for successful engagements. By adding funds, you set up the financial backbone for your campaigns, ensuring users are rewarded for their interactions and contributions.",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#adding-funds",
        resolvingPage: "/product/[productId]/funding",
    },
    "running-bank": {
        key: "running-bank",
        name: "Activate Funding Bank",
        description:
            "Initialize the funding bank to make funds available for campaigns, allowing the system to allocate rewards automatically. Activating your funding bank ensures that your campaigns are ready to incentivize users as soon as they engage with your product.",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#campaigns-funding-status",
        resolvingPage: "/product/[productId]/funding",
    },
    "add-campaign": {
        key: "add-campaign",
        name: "Launch Campaign",
        description:
            "Kick off a word-of-mouth acquisition campaign to drive user engagement and expand product reach. Campaigns let you harness the power of referrals by rewarding users for sharing your product, turning satisfied customers into active promoters.",
        documentationLink: "https://docs.frak.id/business/campaign/create",
        resolvingPage: "/campaigns/new",
    },
};

/**
 * Mock setup status - some steps complete, some need attention
 */
const MOCK_SETUP_STATUS: Record<SetupStatusItemKey, boolean> = {
    "other-admin": true, // Complete
    "interaction-setup": true, // Complete
    "delegated-interaction": true, // Complete
    "oracle-updater-allowed": false, // Needs attention
    "webhook-setup": false, // Needs attention
    "add-funding": true, // Complete
    "running-bank": false, // Needs attention
    "add-campaign": false, // Needs attention
};

/**
 * Hook to get product setup status with real data integration
 */
export function useProductSetupStatus({ productId }: { productId: Hex }) {
    const isDemoMode = demoModeStore((state) => state.isDemoMode);

    // Fetch real data from other hooks
    const { data: administrators, isSuccess: isAdministratorsSuccess } =
        useGetProductAdministrators({ productId });
    const { data: fundings, isSuccess: isFundingsSuccess } =
        useGetProductFunding({ productId });

    return useQuery({
        queryKey: [
            "product",
            "setup-status",
            productId,
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async (): Promise<ProductSetupStatus> => {
            // In demo mode, use mock data
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));

                const items: ProductSetupStatusItem[] = Object.entries(
                    BASE_STEPS
                ).map(([key, step]) => ({
                    ...step,
                    isGood:
                        MOCK_SETUP_STATUS[key as SetupStatusItemKey] ?? false,
                    resolvingPage: step.resolvingPage.replace(
                        "[productId]",
                        productId
                    ),
                }));

                return {
                    items,
                    hasWarning: items.some((item) => !item.isGood),
                };
            }

            // Build steps with real data checks
            const steps: ProductSetupStatusItem[] = [];

            // Check if product has other admins (real data)
            const hasOtherAdmin =
                (administrators?.filter((admin) => admin.roleDetails.admin)
                    .length ?? 0) > 1;
            steps.push({
                ...BASE_STEPS["other-admin"],
                isGood: hasOtherAdmin,
                resolvingPage: BASE_STEPS["other-admin"].resolvingPage.replace(
                    "[productId]",
                    productId
                ),
            });

            // Interaction-related steps (placeholder - requires blockchain integration)
            // TODO: Implement interaction contract checks
            steps.push({
                ...BASE_STEPS["interaction-setup"],
                isGood: false, // Placeholder
                resolvingPage: BASE_STEPS[
                    "interaction-setup"
                ].resolvingPage.replace("[productId]", productId),
            });
            steps.push({
                ...BASE_STEPS["delegated-interaction"],
                isGood: false, // Placeholder
                resolvingPage: BASE_STEPS[
                    "delegated-interaction"
                ].resolvingPage.replace("[productId]", productId),
            });

            // Purchase-related steps (placeholder - requires backend API integration)
            // TODO: Implement webhook status check
            steps.push({
                ...BASE_STEPS["oracle-updater-allowed"],
                isGood: false, // Placeholder
                resolvingPage: BASE_STEPS[
                    "oracle-updater-allowed"
                ].resolvingPage.replace("[productId]", productId),
            });
            steps.push({
                ...BASE_STEPS["webhook-setup"],
                isGood: false, // Placeholder
                resolvingPage: BASE_STEPS[
                    "webhook-setup"
                ].resolvingPage.replace("[productId]", productId),
            });

            // Check funding status (real data)
            const hasFunding =
                fundings?.some((funding) => funding.balance > 0n) ?? false;
            steps.push({
                ...BASE_STEPS["add-funding"],
                isGood: hasFunding,
                resolvingPage: BASE_STEPS["add-funding"].resolvingPage.replace(
                    "[productId]",
                    productId
                ),
            });

            const hasRunningBank =
                fundings?.some((funding) => funding.isDistributing) ?? false;
            steps.push({
                ...BASE_STEPS["running-bank"],
                isGood: hasRunningBank,
                resolvingPage: BASE_STEPS["running-bank"].resolvingPage.replace(
                    "[productId]",
                    productId
                ),
            });

            // Campaign check (placeholder - requires blockchain integration)
            // TODO: Implement campaign count check
            steps.push({
                ...BASE_STEPS["add-campaign"],
                isGood: false, // Placeholder
                resolvingPage: BASE_STEPS["add-campaign"].resolvingPage.replace(
                    "[productId]",
                    productId
                ),
            });

            return {
                items: steps,
                hasWarning: steps.some((step) => !step.isGood),
            };
        },
        enabled: !!productId && isAdministratorsSuccess && isFundingsSuccess,
    });
}
