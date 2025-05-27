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
import { businessApi } from "@frak-labs/shared/context/server";
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
    // Is the oracle updater allowed?
    | "oracle-updater-allowed"
    // Is the purchase webhook setup correctly?
    | "webhook-setup"
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
    const { data: oracleUpdater, isSuccess: isOracleUpdaterSuccess } =
        useGetAdminWallet({
            key: "oracle-updater",
        });
    const {
        data: purchaseRelatedSteps,
        isSuccess: isPurchaseRelatedStepsSuccess,
    } = useQuery({
        enabled:
            !!productId && isProductMetadataSuccess && isOracleUpdaterSuccess,
        queryKey: ["product", "setup-status", "purchase", productId],
        queryFn: async () => {
            // If it doesn't include purchase type, early exit
            if (!productMetadata?.productTypes?.includes("purchase")) return [];
            const steps: ProductSetupStatusItem[] = [];

            // Get the current backend setup status
            const { data: webhookStatus } = await businessApi
                .oracle({ productId })
                .status.get();
            const hasWebhook = !!webhookStatus?.setup;
            steps.push({
                isGood: hasWebhook,
                ...baseSteps["webhook-setup"],
            });

            // Check if the updater is allowed on this product
            if (oracleUpdater) {
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
            }
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
            "Grant Frak the ability to log and manage interactions on your behalf, simplifying the process of tracking engagement for this product. By authorizing Frak as an Interaction/CRM validator, you’ll streamline data management for your campaigns.",
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
