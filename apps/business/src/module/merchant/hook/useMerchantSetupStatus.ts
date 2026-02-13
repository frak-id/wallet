import { useQuery } from "@tanstack/react-query";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useGetMerchantAdministrators } from "./useGetMerchantAdministrators";
import { useGetMerchantBank } from "./useGetMerchantBank";

type SetupStatusItemKey =
    | "other-admin"
    | "add-funding"
    | "running-bank"
    | "add-campaign";

export type MerchantSetupStatusItem = {
    key: SetupStatusItemKey;
    name: string;
    description: string;
    isGood: boolean;
    documentationLink?: string;
    resolvingPage: string;
};

export type MerchantSetupStatus = {
    items: MerchantSetupStatusItem[];
    hasWarning: boolean;
};

const BASE_STEPS: Record<
    SetupStatusItemKey,
    Omit<MerchantSetupStatusItem, "isGood">
> = {
    "other-admin": {
        key: "other-admin",
        name: "Add an Additional Admin",
        description:
            "Enhance your merchant's security and manageability by adding another admin. This will help ensure multiple team members can oversee the merchant's settings, campaigns, and integrations, maintaining continuity and strengthening access control.",
        documentationLink:
            "https://docs.frak.id/business/product/config/team#adding-a-new-member",
        resolvingPage: "/merchant/[merchantId]/team",
    },
    "add-funding": {
        key: "add-funding",
        name: "Add Merchant Funding",
        description:
            "Fund your merchant to activate campaigns and provide rewards for successful engagements. By adding funds, you set up the financial backbone for your campaigns, ensuring users are rewarded for their interactions and contributions.",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#adding-funds",
        resolvingPage: "/merchant/[merchantId]/funding",
    },
    "running-bank": {
        key: "running-bank",
        name: "Activate Funding Bank",
        description:
            "Initialize the funding bank to make funds available for campaigns, allowing the system to allocate rewards automatically. Activating your funding bank ensures that your campaigns are ready to incentivize users as soon as they engage with your merchant.",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#campaigns-funding-status",
        resolvingPage: "/merchant/[merchantId]/funding",
    },
    "add-campaign": {
        key: "add-campaign",
        name: "Launch Campaign",
        description:
            "Kick off a word-of-mouth acquisition campaign to drive user engagement and expand merchant reach. Campaigns let you harness the power of referrals by rewarding users for sharing your merchant, turning satisfied customers into active promoters.",
        documentationLink: "https://docs.frak.id/business/campaign/create",
        resolvingPage: "/campaigns/new",
    },
};

const MOCK_SETUP_STATUS: Record<SetupStatusItemKey, boolean> = {
    "other-admin": true,
    "add-funding": true,
    "running-bank": false,
    "add-campaign": false,
};

export function useMerchantSetupStatus({ merchantId }: { merchantId: string }) {
    const isDemoMode = useIsDemoMode();

    const { data: administrators, isSuccess: isAdministratorsSuccess } =
        useGetMerchantAdministrators({ merchantId });
    const { data: bankData, isSuccess: isBankSuccess } = useGetMerchantBank({
        merchantId,
    });

    return useQuery({
        queryKey: [
            "merchant",
            merchantId,
            "setup-status",
            isDemoMode ? "demo" : "live",
        ],
        queryFn: async (): Promise<MerchantSetupStatus> => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));

                const items: MerchantSetupStatusItem[] = Object.entries(
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

            const steps: MerchantSetupStatusItem[] = [];

            // Check if there's more than one admin (owner)
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

            // Check if merchant has funding
            const hasFunding =
                bankData?.tokens?.some((token) => token.balance > 0n) ?? false;
            steps.push({
                ...BASE_STEPS["add-funding"],
                isGood: hasFunding,
                resolvingPage: BASE_STEPS["add-funding"].resolvingPage.replace(
                    "[merchantId]",
                    merchantId
                ),
            });

            // Check if funding bank is open
            const hasRunningBank = bankData?.isOpen === true;
            steps.push({
                ...BASE_STEPS["running-bank"],
                isGood: hasRunningBank,
                resolvingPage: BASE_STEPS["running-bank"].resolvingPage.replace(
                    "[merchantId]",
                    merchantId
                ),
            });

            // Campaign step - TODO: Check if there are active campaigns
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
        enabled: !!merchantId && isAdministratorsSuccess && isBankSuccess,
    });
}
