import type { Address } from "viem";
import type { InteractionType } from "../../domain/rewards/types";

export type ResolvedIdentity = {
    identityGroupId: string;
    walletAddress?: Address;
};

export type HandlerContext = {
    identity: ResolvedIdentity;
    merchantId: string;
};

export type InteractionLogResult = {
    id: string;
    type: InteractionType;
    identityGroupId: string;
    merchantId: string;
    createdAt: Date;
} | null;

export type HandlerResult<TExtra = Record<string, unknown>> = {
    interactionLog: InteractionLogResult;
    isDuplicate: boolean;
} & TExtra;

export interface InteractionHandler<
    TInput extends { merchantId: string },
    TPayload,
    TExtra = Record<string, unknown>,
> {
    getInteractionType(input: TInput): InteractionType;

    buildExternalEventId(
        input: TInput,
        payload: TPayload,
        context: HandlerContext
    ): string;

    buildPayload(input: TInput, context: HandlerContext): Promise<TPayload>;

    postProcess?(
        input: TInput,
        context: HandlerContext,
        payload: TPayload
    ): Promise<TExtra>;

    validateContext?(input: TInput, context: HandlerContext): void;

    shouldCreateInteractionLog?(input: TInput, payload: TPayload): boolean;
}
