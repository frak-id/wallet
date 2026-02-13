import type {
    CustomPayload,
    InteractionType,
} from "../../../domain/rewards/types";
import type { HandlerContext, InteractionHandler } from "../types";

export type CustomInput = {
    merchantId: string;
    customType: string;
    data?: Record<string, unknown>;
    idempotencyKey?: string;
};

export type CustomExtra = Record<string, unknown>;

export class CustomHandler
    implements InteractionHandler<CustomInput, CustomPayload, CustomExtra>
{
    getInteractionType(_input: CustomInput): InteractionType {
        return "custom";
    }

    buildExternalEventId(
        input: CustomInput,
        _payload: CustomPayload,
        context: HandlerContext
    ): string {
        return `custom:${input.customType}:${input.merchantId}:${context.identity.identityGroupId}:${input.idempotencyKey ?? Date.now()}`;
    }

    async buildPayload(
        input: CustomInput,
        _context: HandlerContext
    ): Promise<CustomPayload> {
        return {
            customType: input.customType,
            data: input.data ?? {},
        };
    }

    async postProcess(): Promise<CustomExtra> {
        return {};
    }
}
