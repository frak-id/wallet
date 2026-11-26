import { useQuery } from "@tanstack/react-query";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { merchantSetupStatusQueryKey } from "@/module/merchant/queries/queryKeys";
import { useGetMerchantAdministrators } from "./useGetMerchantAdministrators";
import { useGetMerchantBank } from "./useGetMerchantBank";

type SetupStatusItemKey =
    | "other-admin"
    | "add-funding"
    | "running-bank"
    | "add-campaign";

type SetupStep = {
    key: SetupStatusItemKey;
    nameKey: ParseKeys;
    descriptionKey: ParseKeys;
    documentationLink?: string;
    resolvingPage: string;
};

type SetupStepStatus = SetupStep & { isGood: boolean };

type SetupStatusData = {
    items: SetupStepStatus[];
    hasWarning: boolean;
};

export type MerchantSetupStatusItem = Omit<
    SetupStepStatus,
    "nameKey" | "descriptionKey"
> & {
    name: string;
    description: string;
};

export type MerchantSetupStatus = {
    items: MerchantSetupStatusItem[];
    hasWarning: boolean;
};

const BASE_STEPS: Record<SetupStatusItemKey, SetupStep> = {
    "other-admin": {
        key: "other-admin",
        nameKey: "merchant.setupStatus.steps.otherAdmin.name",
        descriptionKey: "merchant.setupStatus.steps.otherAdmin.description",
        documentationLink:
            "https://docs.frak.id/business/product/config/team#adding-a-new-member",
        resolvingPage: "/merchant/[merchantId]/team",
    },
    "add-funding": {
        key: "add-funding",
        nameKey: "merchant.setupStatus.steps.addFunding.name",
        descriptionKey: "merchant.setupStatus.steps.addFunding.description",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#adding-funds",
        resolvingPage: "/merchant/[merchantId]/funding",
    },
    "running-bank": {
        key: "running-bank",
        nameKey: "merchant.setupStatus.steps.runningBank.name",
        descriptionKey: "merchant.setupStatus.steps.runningBank.description",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#campaigns-funding-status",
        resolvingPage: "/merchant/[merchantId]/funding",
    },
    "add-campaign": {
        key: "add-campaign",
        nameKey: "merchant.setupStatus.steps.addCampaign.name",
        descriptionKey: "merchant.setupStatus.steps.addCampaign.description",
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
    const { t } = useTranslation();
    const isDemoMode = useIsDemoMode();

    const { data: administrators, isSuccess: isAdministratorsSuccess } =
        useGetMerchantAdministrators({ merchantId });
    const { data: bankData, isSuccess: isBankSuccess } = useGetMerchantBank({
        merchantId,
    });

    return useQuery({
        queryKey: merchantSetupStatusQueryKey(merchantId, isDemoMode),
        queryFn: async (): Promise<SetupStatusData> => {
            if (isDemoMode) {
                await new Promise((resolve) => setTimeout(resolve, 300));

                const items: SetupStepStatus[] = Object.entries(BASE_STEPS).map(
                    ([key, step]) => ({
                        ...step,
                        isGood:
                            MOCK_SETUP_STATUS[key as SetupStatusItemKey] ??
                            false,
                        resolvingPage: step.resolvingPage.replace(
                            "[merchantId]",
                            merchantId
                        ),
                    })
                );

                return {
                    items,
                    hasWarning: items.some((item) => !item.isGood),
                };
            }

            const steps: SetupStepStatus[] = [];

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
        select: (data): MerchantSetupStatus => ({
            hasWarning: data.hasWarning,
            items: data.items.map(({ nameKey, descriptionKey, ...item }) => ({
                ...item,
                name: t(nameKey),
                description: t(descriptionKey),
            })),
        }),
        enabled: !!merchantId && isAdministratorsSuccess && isBankSuccess,
    });
}
