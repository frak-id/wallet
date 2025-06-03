import { t } from "@backend-utils";

export const InteractionRequestDto = t.Object({
    wallet: t.Address(),
    productId: t.Hex(),
    interaction: t.Object({
        handlerTypeDenominator: t.Hex(),
        interactionData: t.Hex(),
    }),
    signature: t.Optional(t.Union([t.Hex(), t.Undefined(), t.Null()])),
});

export const BackendInteractionDto = t.Omit(InteractionRequestDto, [
    "productId",
]);

/**
 * A raw backend interaction is an interaction identified by its key, and it's unknown data.
 */
export const RawBackendInteractionDto = t.Object({
    wallet: t.Address(),
    key: t.Hex(),
    data: t.Array(t.Unknown()),
});
