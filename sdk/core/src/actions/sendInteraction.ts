import type {
    FrakClient,
    SendInteractionParamsType,
    SendInteractionReturnType,
} from "../types";
import { computeProductId } from "../utils/computeProductId";

/**
 * Function used to send an interaction
 * @param client - The current Frak Client
 * @param args
 *
 * @example
 * const interaction = PressInteractionEncoder.openArticle({
 *     articleId: keccak256(toHex("article-slug")),
 * });
 * const { delegationId } = await sendInteraction(frakConfig, {
 *     interaction,
 * });
 * console.log("Delegated interaction id", delegationId);
 */
export async function sendInteraction(
    client: FrakClient,
    { productId, interaction, validation, campaignId }: SendInteractionParamsType
): Promise<SendInteractionReturnType> {
    const pId = productId ?? computeProductId(client.config);

    return await client.request({
        method: "frak_sendInteraction",
        params: [pId, interaction, validation, campaignId],
    });
}
