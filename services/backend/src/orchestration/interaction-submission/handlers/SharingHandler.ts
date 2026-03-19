import type { Address } from "viem";
import type {
    CreateReferralLinkPayload,
    InteractionType,
} from "../../../domain/rewards/types";
import type { HandlerContext, InteractionHandler } from "../types";

export type SharingInput = {
    merchantId: string;
    sharingTimestamp?: number;
    purchaseId?: string;
};

export type SharingExtra = Record<string, unknown>;

export class SharingHandler
    implements
        InteractionHandler<
            SharingInput,
            CreateReferralLinkPayload,
            SharingExtra
        >
{
    getInteractionType(_input: SharingInput): InteractionType {
        return "create_referral_link";
    }

    buildExternalEventId(
        input: SharingInput,
        _payload: CreateReferralLinkPayload,
        context: HandlerContext
    ): string {
        const key = input.purchaseId ?? Date.now();
        return `create_referral_link:${context.identity.identityGroupId}:${input.merchantId}:${key}`;
    }

    async buildPayload(
        input: SharingInput,
        context: HandlerContext
    ): Promise<CreateReferralLinkPayload> {
        // Fialsafe check, should be validated in validateContext
        if (!context.identity.walletAddress) {
            throw new Error("Wallet address required for sharing interaction");
        }

        return {
            sharerWallet: context.identity.walletAddress as Address,
            merchantId: input.merchantId,
            ...(input.sharingTimestamp !== undefined && {
                sharingTimestamp: input.sharingTimestamp,
            }),
            ...(input.purchaseId !== undefined && {
                purchaseId: input.purchaseId,
            }),
        };
    }

    async postProcess(): Promise<SharingExtra> {
        return {};
    }

    validateContext(_input: SharingInput, context: HandlerContext): void {
        if (!context.identity.walletAddress) {
            throw new Error("Wallet address required for sharing interaction");
        }
    }
}
