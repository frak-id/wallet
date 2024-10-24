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
import {
    CircleDollarSign,
    Crosshair,
    Database,
    type LucideProps,
    Signature,
    Users,
} from "lucide-react";
import type { JSXElementConstructor } from "react";
import type * as react from "react";
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
    // Does the product has a campaign
    | "add-campaign";

export type ProductSetupStatusItem = {
    position: number;
    key: SetupStatusItemKey;
    name: string;
    description: string;
    logo: JSXElementConstructor<
        Omit<LucideProps, "ref"> & react.RefAttributes<SVGSVGElement>
    >;
    status: "ok" | "warning";
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

            const hasCampaign = true;

            // Build the output steps
            const steps: ProductSetupStatusItem[] = [
                {
                    ...baseSteps["other-admin"],
                    status: hasOtherAdmin ? "ok" : "warning",
                },
                {
                    ...baseSteps["interaction-setup"],
                    status: hasInteractionContract ? "ok" : "warning",
                },
                {
                    ...baseSteps["delegated-interaction"],
                    status: isDelegatedSignerApproved ? "ok" : "warning",
                },
                {
                    ...baseSteps["add-funding"],
                    status: hasFunding ? "ok" : "warning",
                },
                {
                    ...baseSteps["add-campaign"],
                    status: hasCampaign ? "ok" : "warning",
                },
            ];

            return {
                items: steps,
                hasWarning: steps.some((step) => step.status === "warning"),
            };
        },
    });
}

/**
 * Base steps infos
 */
const baseSteps: Record<
    SetupStatusItemKey,
    Omit<ProductSetupStatusItem, "status">
> = {
    "other-admin": {
        key: "other-admin",
        position: 1,
        name: "Add another admin",
        description: "Add another admin to the product for better security",
        logo: Users,
        resolvingPage: "/product/[productId]/team",
    },
    "interaction-setup": {
        key: "interaction-setup",
        position: 2,
        name: "Create the interaction/CRM event contract",
        description: "Create an on-chain CRM receiver for your Product",
        logo: Database,
        resolvingPage: "/product/[productId]#deployInteraction",
    },
    "delegated-interaction": {
        key: "delegated-interaction",
        position: 3,
        name: "Allow Interaction/CRM validator",
        description: "Allow Frak to submit user interactions for your Product",
        logo: Signature,
        resolvingPage: "/product/[productId]#allowInteractionDelegator",
    },
    "add-funding": {
        key: "add-funding",
        position: 4,
        name: "Add funding",
        description:
            "Add funding to your product to create your first campaigns",
        logo: CircleDollarSign,
        resolvingPage: "/product/[productId]/funding",
    },
    "add-campaign": {
        key: "add-campaign",
        position: 5,
        name: "Add a campaign",
        description: "Create your first mouth to mouth campaign",
        logo: Crosshair,
        resolvingPage: "/campaigns/new",
    },
};
