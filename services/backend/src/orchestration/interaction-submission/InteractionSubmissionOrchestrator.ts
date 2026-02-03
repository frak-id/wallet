import { eventEmitter, log } from "@backend-infrastructure";
import type { AttributionService } from "../../domain/attribution/services/AttributionService";
import type { InteractionLogRepository } from "../../domain/rewards/repositories/InteractionLogRepository";
import type {
    InteractionPayload,
    InteractionType,
} from "../../domain/rewards/types";
import { ArrivalHandler, CustomHandler, SharingHandler } from "./handlers";
import type {
    HandlerContext,
    HandlerResult,
    InteractionHandler,
    InteractionLogResult,
    ResolvedIdentity,
} from "./types";

type HandlerMap = {
    arrival: ArrivalHandler;
    sharing: SharingHandler;
    custom: CustomHandler;
};

export type SubmissionType = keyof HandlerMap;

type InferInput<H> =
    H extends InteractionHandler<infer I, unknown, unknown> ? I : never;

type InferExtra<H> =
    H extends InteractionHandler<{ merchantId: string }, unknown, infer E>
        ? E
        : never;

type InputFor<T extends SubmissionType> = InferInput<HandlerMap[T]>;
type ExtraFor<T extends SubmissionType> = InferExtra<HandlerMap[T]>;

export type InteractionSubmission = {
    [T in SubmissionType]: { type: T } & InputFor<T>;
}[SubmissionType];

export class InteractionSubmissionOrchestrator {
    private readonly handlers: HandlerMap;

    constructor(
        private readonly interactionLogRepository: InteractionLogRepository,
        attributionService: AttributionService
    ) {
        this.handlers = {
            arrival: new ArrivalHandler(attributionService),
            sharing: new SharingHandler(),
            custom: new CustomHandler(),
        };
    }

    async submit<T extends SubmissionType>(
        submission: { type: T } & InputFor<T>,
        identity: ResolvedIdentity
    ): Promise<HandlerResult<ExtraFor<T>>> {
        const context: HandlerContext = {
            identity,
            merchantId: submission.merchantId,
        };

        const handler = this.handlers[submission.type];

        return this.handle(
            handler as unknown as InteractionHandler<
                InputFor<T>,
                unknown,
                ExtraFor<T>
            >,
            submission,
            context
        );
    }

    private async handle<
        TInput extends { merchantId: string },
        TPayload,
        TExtra extends Record<string, unknown>,
    >(
        handler: InteractionHandler<TInput, TPayload, TExtra>,
        input: TInput,
        context: HandlerContext
    ): Promise<HandlerResult<TExtra>> {
        handler.validateContext?.(input, context);

        const payload = await handler.buildPayload(input, context);

        let interactionLog: InteractionLogResult = null;
        let isDuplicate = false;

        const shouldCreate =
            handler.shouldCreateInteractionLog?.(input) ?? true;
        if (shouldCreate) {
            const externalEventId = handler.buildExternalEventId(
                input,
                payload,
                context
            );

            const result = await this.interactionLogRepository.createIdempotent(
                {
                    type: handler.getInteractionType(input),
                    identityGroupId: context.identity.identityGroupId,
                    merchantId: input.merchantId,
                    externalEventId,
                    payload: payload as InteractionPayload,
                }
            );

            if (result) {
                interactionLog = this.toInteractionLogResult(result);
                this.emitNewInteraction(handler.getInteractionType(input));
            } else {
                isDuplicate = true;
            }
        }

        const extra =
            (await handler.postProcess?.(input, context, payload)) ??
            ({} as TExtra);

        log.info(
            {
                interactionType: handler.getInteractionType(input),
                identityGroupId: context.identity.identityGroupId,
                merchantId: input.merchantId,
                interactionLogId: interactionLog?.id ?? null,
                isDuplicate,
            },
            "Interaction tracked"
        );

        return {
            interactionLog,
            isDuplicate,
            ...extra,
        };
    }

    private toInteractionLogResult(result: {
        id: string;
        type: InteractionType;
        identityGroupId: string | null;
        merchantId: string | null;
        createdAt: Date;
    }): InteractionLogResult {
        return {
            id: result.id,
            type: result.type,
            identityGroupId: result.identityGroupId ?? "",
            merchantId: result.merchantId ?? "",
            createdAt: result.createdAt,
        };
    }

    private emitNewInteraction(type: InteractionType): void {
        eventEmitter.emit("newInteraction", { type });
    }
}
