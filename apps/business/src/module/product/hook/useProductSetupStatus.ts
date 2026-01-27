import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
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
        resolvingPage: "/merchant/[merchantId]/team",
    },
    "interaction-setup": {
        key: "interaction-setup",
        name: "Create Interaction/CRM Event Contract",
        description:
            "Deploy an on-chain CRM event contract to enable this product to record and manage interactions securely on the blockchain. This setup allows you to capture real-time user engagement data, facilitating insights for targeted campaigns and rewards.",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/merchant/[merchantId]#interactionSettings",
    },
    "delegated-interaction": {
        key: "delegated-interaction",
        name: "Authorize Interaction/CRM Validator",
        description:
            "Grant Frak the ability to log and manage interactions on your behalf, simplifying the process of tracking engagement for this product. By authorizing Frak as an Interaction/CRM validator, you'll streamline data management for your campaigns.",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/merchant/[merchantId]#interactionSettings",
    },
    "oracle-updater-allowed": {
        key: "oracle-updater-allowed",
        name: "Authorize Purchase Validation",
        description:
            "Enable Frak to validate each purchase made by users on the blockchain. By authorizing purchase validation, you can automate reward distribution and ensure secure, tamper-proof tracking of user transactions for your product.",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/merchant/[merchantId]#purchaseTracker",
    },
    "webhook-setup": {
        key: "webhook-setup",
        name: "Setup Purchase Webhook",
        description:
            "Configure a webhook between your purchase platform and Frak to seamlessly relay purchase events. This setup lets Frak validate purchases and initiate rewards, ensuring a smooth experience for your users when they make qualifying purchases.",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/merchant/[merchantId]#purchaseTracker",
    },
    "add-funding": {
        key: "add-funding",
        name: "Add Product Funding",
        description:
            "Fund your product to activate campaigns and provide rewards for successful engagements. By adding funds, you set up the financial backbone for your campaigns, ensuring users are rewarded for their interactions and contributions.",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#adding-funds",
        resolvingPage: "/merchant/[merchantId]/funding",
    },
    "running-bank": {
        key: "running-bank",
        name: "Activate Funding Bank",
        description:
            "Initialize the funding bank to make funds available for campaigns, allowing the system to allocate rewards automatically. Activating your funding bank ensures that your campaigns are ready to incentivize users as soon as they engage with your product.",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#campaigns-funding-status",
        resolvingPage: "/merchant/[merchantId]/funding",
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

const MOCK_SETUP_STATUS: Record<SetupStatusItemKey, boolean> = {
    "other-admin": true,
    "interaction-setup": true,
    "delegated-interaction": true,
    "oracle-updater-allowed": false,
    "webhook-setup": false,
    "add-funding": true,
    "running-bank": false,
    "add-campaign": false,
};

export function useProductSetupStatus({ merchantId }: { merchantId: string }) {
    const isDemoMode = useAuthStore((state) => state.token === "demo-token");

    const { data: administrators, isSuccess: isAdministratorsSuccess } =
        useGetProductAdministrators({ merchantId });
    const { data: fundings, isSuccess: isFundingsSuccess } =
        useGetProductFunding({ productId: merchantId });

    return useQuery({
        queryKey: [
            "merchant",
            merchantId,
            "setup-status",
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async (): Promise<ProductSetupStatus> => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));

                const items: ProductSetupStatusItem[] = Object.entries(
                    BASE_STEPS
                ).map(([key, step]) => ({
                    ...step,
                    isGood:
                        MOCK_SETUP_STATUS[key as SetupStatusItemKey] ?? false,
                    resolvingPage: step.resolvingPage.replace(
                        "[merchantId]",
                        merchantId
                    ),
                }));

                return {
                    items,
                    hasWarning: items.some((item) => !item.isGood),
                };
            }

            const steps: ProductSetupStatusItem[] = [];

            const hasOtherAdmin =
                (administrators?.filter((admin) => admin.isOwner).length ?? 0) >
                1;
            steps.push({
                ...BASE_STEPS["other-admin"],
                isGood: hasOtherAdmin,
                resolvingPage: BASE_STEPS["other-admin"].resolvingPage.replace(
                    "[merchantId]",
                    merchantId
                ),
            });

            steps.push({
                ...BASE_STEPS["interaction-setup"],
                isGood: false,
                resolvingPage: BASE_STEPS[
                    "interaction-setup"
                ].resolvingPage.replace("[merchantId]", merchantId),
            });
            steps.push({
                ...BASE_STEPS["delegated-interaction"],
                isGood: false,
                resolvingPage: BASE_STEPS[
                    "delegated-interaction"
                ].resolvingPage.replace("[merchantId]", merchantId),
            });

            steps.push({
                ...BASE_STEPS["oracle-updater-allowed"],
                isGood: false,
                resolvingPage: BASE_STEPS[
                    "oracle-updater-allowed"
                ].resolvingPage.replace("[merchantId]", merchantId),
            });
            steps.push({
                ...BASE_STEPS["webhook-setup"],
                isGood: false,
                resolvingPage: BASE_STEPS[
                    "webhook-setup"
                ].resolvingPage.replace("[merchantId]", merchantId),
            });

            const hasFunding =
                fundings?.some((funding) => funding.balance > 0n) ?? false;
            steps.push({
                ...BASE_STEPS["add-funding"],
                isGood: hasFunding,
                resolvingPage: BASE_STEPS["add-funding"].resolvingPage.replace(
                    "[merchantId]",
                    merchantId
                ),
            });

            const hasRunningBank =
                fundings?.some((funding) => funding.isDistributing) ?? false;
            steps.push({
                ...BASE_STEPS["running-bank"],
                isGood: hasRunningBank,
                resolvingPage: BASE_STEPS["running-bank"].resolvingPage.replace(
                    "[merchantId]",
                    merchantId
                ),
            });

            steps.push({
                ...BASE_STEPS["add-campaign"],
                isGood: false,
                resolvingPage: BASE_STEPS["add-campaign"].resolvingPage.replace(
                    "[merchantId]",
                    merchantId
                ),
            });

            return {
                items: steps,
                hasWarning: steps.some((step) => !step.isGood),
            };
        },
        enabled: !!merchantId && isAdministratorsSuccess && isFundingsSuccess,
    });
}
