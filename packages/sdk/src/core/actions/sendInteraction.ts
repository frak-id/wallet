import type { NexusClient, SendInteractionParamsType } from "../types";

/**
 * Function used to send an interaction
 * @param client
 * @param contentId
 * @param request
 * @param validation
 */
export function sendInteraction(
    client: NexusClient,
    { contentId, interaction, validation }: SendInteractionParamsType
) {
    return client.request({
        method: "frak_sendInteraction",
        params: [contentId, interaction, validation],
    });
}
