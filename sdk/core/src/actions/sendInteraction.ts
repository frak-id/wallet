import type {
    FrakClient,
    SendInteractionParamsType,
    SendInteractionReturnType,
} from "../types";
import { computeProductId } from "../utils/computeProductId";

/**
 * Function used to send an interaction
 * @param client
 * @param productId
 * @param interaction
 * @param validation
 */
export async function sendInteraction(
    client: FrakClient,
    { productId, interaction, validation }: SendInteractionParamsType
): Promise<SendInteractionReturnType> {
    const pId = productId ?? computeProductId(client.config);

    return await client.request({
        method: "frak_sendInteraction",
        params: [pId, interaction, validation],
    });
}
