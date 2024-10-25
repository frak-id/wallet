import { viemClient } from "@/context/blockchain/provider";
import { useGetAdminWallet } from "@/module/common/hook/useGetAdminWallet";
import { useGetProductAdministrators } from "@/module/product/hook/useGetProductAdministrators";
import { useGetProductFunding } from "@/module/product/hook/useGetProductFunding";
import { useProductInteractionContract } from "@/module/product/hook/useProductInteractionContract";
import { useProductMetadata } from "@/module/product/hook/useProductMetadata";
import {
    addresses,
    interactionValidatorRoles,
    productAdministratorRegistryAbi,
    productInteractionDiamondAbi,
    productRoles,
} from "@frak-labs/app-essentials";
import { backendApi } from "@frak-labs/shared/context/server";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";
import { readContract } from "viem/actions";

type SetupStatusItemKey =
    // Does the product have multiple admin?
    | "other-admin"
    // Is the interaction contract setup?
    | "interaction-setup"
    // Is the managed interaction validation allowed?
    | "delegated-interaction"
    // Does the product has funding?
    | "add-funding"
    // Does the product has a running funding bank?
    | "running-bank"
    // Does the product has a campaign
    | "add-campaign";

export type ProductSetupStatusItem = {
    key: SetupStatusItemKey;
    name: string;
    description: string;
    isGood: boolean;
    documentationLink?: string;
    // Page to resolve this issue
    resolvingPage: string;
};

export type ProductSetupStatus = {
    items: ProductSetupStatusItem[];
    hasWarning: boolean;
};

/**
 * Get the overall product setup status
 * @param productId
 */
export function useProductSetupStatus({ productId }: { productId: Hex }) {
    const {
        data: productAdministrators,
        isSuccess: isProductAdministratorSuccess,
    } = useGetProductAdministrators({
        productId,
    });
    const {
        data: productInteractionContract,
        isSuccess: isProductInteractionContractSuccess,
    } = useProductInteractionContract({
        productId,
    });
    const { data: fundings, isSuccess: isFundingSuccess } =
        useGetProductFunding({ productId });
    const { data: productMetadata, isSuccess: isProductMetadataSuccess } =
        useProductMetadata({ productId });

    // Query fetching the setup steps around the interaction contract
    const { data: productValidator, isSuccess: isProductValidatorFetched } =
        useGetAdminWallet({ productId });
    const {
        data: interactionRelatedSteps,
        isSuccess: isInteractionRelatedStepsSuccess,
    } = useQuery({
        enabled:
            !!productId &&
            isProductInteractionContractSuccess &&
            isProductValidatorFetched,
        queryKey: ["product", "setup-status", "interactions", productId],
        queryFn: async () => {
            const steps: ProductSetupStatusItem[] = [];
            const interactionContract =
                productInteractionContract?.interactionContract;
            const hasInteractionContract = !!interactionContract;
            steps.push({
                isGood: hasInteractionContract,
                ...baseSteps["interaction-setup"],
            });

            // Get the product interaction signer
            let isDelegatedSignerApproved = false;
            if (interactionContract && productValidator) {
                isDelegatedSignerApproved = await readContract(viemClient, {
                    abi: productInteractionDiamondAbi,
                    address: interactionContract,
                    functionName: "hasAllRoles",
                    args: [productValidator, interactionValidatorRoles],
                });
            }
            steps.push({
                isGood: isDelegatedSignerApproved,
                ...baseSteps["delegated-interaction"],
            });

            return steps;
        },
    });

    // Query fetching the setup steps around a purchase product
    const { data: oracleUpdater } = useGetAdminWallet({
        key: "oracle-updater",
    });
    const {
        data: purchaseRelatedSteps,
        isSuccess: isPurchaseRelatedStepsSuccess,
    } = useQuery({
        enabled: !!productId && isProductMetadataSuccess,
        queryKey: ["product", "setup-status", "purchase", productId],
        queryFn: async () => {
            // If it doesn't include purchase type, early exit
            if (!productMetadata?.productTypes?.includes("purchase")) return [];
            const steps: ProductSetupStatusItem[] = [];

            // Get the current backend setup status
            const { data: webhookStatus } = await backendApi
                .oracle({ productId })
                .status.get();
            const hasWebhook = !!webhookStatus?.setup;
            steps.push({
                isGood: hasWebhook,
                ...baseSteps["webhook-setup"],
            });

            // Check if the updater is allowed on this product
            const isOracleUpdaterAllowed = await readContract(viemClient, {
                abi: productAdministratorRegistryAbi,
                address: addresses.productAdministratorRegistry,
                functionName: "hasAllRolesOrOwner",
                args: [
                    BigInt(productId),
                    oracleUpdater,
                    productRoles.purchaseOracleUpdater,
                ],
            });
            steps.push({
                isGood: isOracleUpdaterAllowed,
                ...baseSteps["oracle-updater-allowed"],
            });
            return steps;
        },
    });

    return useQuery({
        enabled:
            !!productId &&
            isProductAdministratorSuccess &&
            isInteractionRelatedStepsSuccess &&
            isPurchaseRelatedStepsSuccess &&
            isFundingSuccess,
        queryKey: ["product", "setup-status", productId],
        async queryFn(): Promise<ProductSetupStatus> {
            const steps: ProductSetupStatusItem[] = [];

            // Check if the product has at least one administrator
            {
                const hasOtherAdmin =
                    productAdministrators?.some(
                        (admin) => admin.roleDetails.admin
                    ) ?? false;
                steps.push({
                    isGood: hasOtherAdmin,
                    ...baseSteps["other-admin"],
                });
            }

            // Get the product interaction related steps
            steps.push(...(interactionRelatedSteps ?? []));
            // Get the product purchase related steps
            steps.push(...(purchaseRelatedSteps ?? []));

            // Check if at least one of the banks is good
            const hasFunding =
                fundings?.some((funding) => funding.balance > 0n) ?? false;
            steps.push({
                isGood: hasFunding,
                ...baseSteps["add-funding"],
            });
            const hasRunningFunding =
                fundings?.some((funding) => funding.isDistributing) ?? false;
            steps.push({
                isGood: hasRunningFunding,
                ...baseSteps["running-bank"],
            });

            // Check if the product has a campaign or not
            let hasCampaign = false;
            if (productInteractionContract?.interactionContract) {
                const campaigns = await readContract(viemClient, {
                    abi: productInteractionDiamondAbi,
                    address: productInteractionContract?.interactionContract,
                    functionName: "getCampaigns",
                });
                hasCampaign = campaigns.length > 0;
            }
            steps.push({
                isGood: hasCampaign,
                ...baseSteps["add-campaign"],
            });

            return {
                items: steps.map((step) => ({
                    ...step,
                    resolvingPage: step.resolvingPage.replace(
                        "[productId]",
                        productId
                    ),
                })),
                hasWarning: steps.some((step) => !step.isGood),
            };
        },
    });
}

/**
 * Base steps infos
 */
const baseSteps: Record<
    SetupStatusItemKey,
    Omit<ProductSetupStatusItem, "isGood" | "position">
> = {
    "other-admin": {
        key: "other-admin",
        name: "Add another admin",
        description: "Add another admin to the product for better security",
        documentationLink:
            "https://docs.frak.id/business/product/config/team#adding-a-new-member",
        resolvingPage: "/product/[productId]/team",
    },
    "interaction-setup": {
        key: "interaction-setup",
        name: "Create the interaction/CRM event contract",
        description: "Create an on-chain CRM receiver for your Product",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#deployInteraction",
    },
    "delegated-interaction": {
        key: "delegated-interaction",
        name: "Allow Interaction/CRM validator",
        description: "Allow Frak to submit user interactions for your Product",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#allowInteractionDelegator",
    },
    "oracle-updater-allowed": {
        key: "oracle-updater-allowed",
        name: "Allow Frak to validate Purchase",
        description:
            "Allow the Frak system to validate the purchase made by your users on the blockchain.",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#allowOracleUpdater",
    },
    "webhook-setup": {
        key: "delegated-interaction",
        name: "Webhook setup with your purchase platform",
        description:
            "Setup a webhook to let Frak receive and validate purchase events, to be able to reward users upon purchase",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#setupWebhook",
    },
    "add-funding": {
        key: "add-funding",
        name: "Add funds for your product",
        description:
            "Add funding to your product to create your first campaigns",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#adding-funds",
        resolvingPage: "/product/[productId]/funding",
    },
    "running-bank": {
        key: "running-bank",
        name: "Start your funding bank",
        description: "Start up your funding bank to let campaigns reward users",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#campaigns-funding-status",
        resolvingPage: "/product/[productId]/funding",
    },
    "add-campaign": {
        key: "add-campaign",
        name: "Launch a campaign",
        description: "Launch a word-of-mouth acquisition campaign",
        documentationLink: "https://docs.frak.id/business/campaign/create",
        resolvingPage: "/campaigns/new",
    },
};
