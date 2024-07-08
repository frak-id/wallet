import type {
    NexusClient,
    SendInteractionParamsType,
    SendInteractionReturnType,
} from "../types";

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
    return await client.request({
        method: "frak_sendInteraction",
        params: [contentId, interaction, validation],
    });
}
