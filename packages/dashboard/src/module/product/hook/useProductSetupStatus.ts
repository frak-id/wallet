import { viemClient } from "@/context/blockchain/provider";
import { useGetProductAdministrators } from "@/module/product/hook/useGetProductAdministrators";
import { useGetProductFunding } from "@/module/product/hook/useGetProductFunding";
import { useProductInteractionContract } from "@/module/product/hook/useProductInteractionContract";
import {
    interactionValidatorRoles,
    productInteractionDiamondAbi,
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
    position: number;
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

    return useQuery({
        enabled:
            !!productId &&
            isProductAdministratorSuccess &&
            isProductInteractionContractSuccess &&
            isFundingSuccess,
        queryKey: ["product", "setup-status", productId],
        async queryFn(): Promise<ProductSetupStatus> {
            // Check if the product has at least one administrator
            const hasOtherAdmin =
                productAdministrators?.some(
                    (admin) => admin.roleDetails.admin
                ) ?? false;

            // Check if the product has a interaction contract
            const interactionContract =
                productInteractionContract?.interactionContract;
            const hasInteractionContract = !!interactionContract;

            // Get the product interaction signer
            let isDelegatedSignerApproved = false;
            const { data: productSignerResult } =
                await backendApi.common.adminWallet.get({
                    query: { productId },
                });
            if (interactionContract && productSignerResult?.pubKey) {
                isDelegatedSignerApproved = await readContract(viemClient, {
                    abi: productInteractionDiamondAbi,
                    address: interactionContract,
                    functionName: "hasAllRoles",
                    args: [
                        productSignerResult.pubKey,
                        interactionValidatorRoles,
                    ],
                });
            }

            // Check if at least one of the banks is good
            const hasFunding =
                fundings?.some((funding) => funding.balance > 0n) ?? false;
            const hasRunningFunding =
                fundings?.some((funding) => funding.isDistributing) ?? false;

            const hasCampaign = true;

            // Build the output steps
            const steps: ProductSetupStatusItem[] = [
                {
                    ...baseSteps["other-admin"],
                    isGood: hasOtherAdmin,
                },
                {
                    ...baseSteps["interaction-setup"],
                    isGood: hasInteractionContract,
                },
                {
                    ...baseSteps["delegated-interaction"],
                    isGood: isDelegatedSignerApproved,
                },
                {
                    ...baseSteps["add-funding"],
                    isGood: hasFunding,
                },
                {
                    ...baseSteps["running-bank"],
                    isGood: hasRunningFunding,
                },
                {
                    ...baseSteps["add-campaign"],
                    isGood: hasCampaign,
                },
            ].map((step) => ({
                ...step,
                resolvingPage: step.resolvingPage.replace(
                    "[productId]",
                    productId
                ),
            }));

            return {
                items: steps,
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
    Omit<ProductSetupStatusItem, "isGood">
> = {
    "other-admin": {
        key: "other-admin",
        position: 1,
        name: "Add another admin",
        description: "Add another admin to the product for better security",
        documentationLink:
            "https://docs.frak.id/business/product/config/team#adding-a-new-member",
        resolvingPage: "/product/[productId]/team",
    },
    "interaction-setup": {
        key: "interaction-setup",
        position: 2,
        name: "Create the interaction/CRM event contract",
        description: "Create an on-chain CRM receiver for your Product",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#deployInteraction",
    },
    "delegated-interaction": {
        key: "delegated-interaction",
        position: 3,
        name: "Allow Interaction/CRM validator",
        description: "Allow Frak to submit user interactions for your Product",
        documentationLink:
            "https://docs.frak.id/business/product/config/edit#interaction-settings",
        resolvingPage: "/product/[productId]#allowInteractionDelegator",
    },
    "add-funding": {
        key: "add-funding",
        position: 4,
        name: "Add funding",
        description:
            "Add funding to your product to create your first campaigns",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#adding-funds",
        resolvingPage: "/product/[productId]/funding",
    },
    "running-bank": {
        key: "running-bank",
        position: 5,
        name: "Start your funding bank",
        description: "Start up your funding bank to let campaigns reward users",
        documentationLink:
            "https://docs.frak.id/business/product/config/funds#campaigns-funding-status",
        resolvingPage: "/product/[productId]/funding",
    },
    "add-campaign": {
        key: "add-campaign",
        position: 6,
        name: "Create your first campaign",
        description: "Create your first word-of-mouth acquisition campaign",
        documentationLink: "https://docs.frak.id/business/campaign/create",
        resolvingPage: "/campaigns/new",
    },
};
