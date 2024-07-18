import type {
    DisplayModalParamsType,
    ModalRpcResponse,
    ModalTypes,
    NexusClient,
} from "../types";

/**
 * Function used to display a modal
 * @param client
 * @param contentId
 */
export async function displayModal<TModalTypes extends ModalTypes[]>(
    client: NexusClient,
    { modal, context }: DisplayModalParamsType<TModalTypes>
): Promise<ModalRpcResponse<TModalTypes>> {
    return await client.request({
        method: "frak_displayModal",
        params: [modal, context],
    });
}
