import { t } from "@backend-utils";

export const InteractionRequestDto = t.Object({
    wallet: t.Address(),
    productId: t.Hex(),
    interaction: t.Object({
        handlerTypeDenominator: t.Hex(),
        interactionData: t.Hex(),
    }),
    signature: t.Union([t.Hex(), t.Undefined(), t.Null()]),
});
