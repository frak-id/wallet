import type {
    NexusClient,
    SendInteractionParamsType,
    SendInteractionReturnType,
} from "../types";
import { computeContentId } from "../utils/computeContentId";

/**
 * Function used to send an interaction
 * @param client
 * @param contentId
 * @param request
 * @param validation
 */
export async function sendInteraction(
    client: NexusClient,
    { contentId, interaction, validation }: SendInteractionParamsType
): Promise<SendInteractionReturnType> {
    const cId = contentId ?? computeContentId(client.config);

    return await client.request({
        method: "frak_sendInteraction",
        params: [cId, interaction, validation],
    });
}
