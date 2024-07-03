import {
    FrakRpcError,
    type NexusClient,
    RpcErrorCodes,
    type SendInteractionParamsType,
    type SendInteractionReturnType,
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
): Promise<Extract<SendInteractionReturnType, { key: "success" }>> {
    const result = await client.request({
        method: "frak_sendInteraction",
        params: [contentId, interaction, validation],
    });

    switch (result.key) {
        case "error":
            throw new FrakRpcError(
                RpcErrorCodes.serverError,
                result.reason ??
                    "An error occurred while sending the interaction"
            );
        case "success":
            return result;
    }
}
