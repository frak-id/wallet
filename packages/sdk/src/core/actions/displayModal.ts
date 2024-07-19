import type {
    DisplayModalParamsType,
    ModalRpcStepsResultType,
    ModalStepTypes,
    NexusClient,
} from "../types";

/*
TODO:
 - Should enforce the result type depending on the request type
 - Should be able to have smth like a pre send hook on the sdk level to fullfill some informations from the client if needed (notably about siwe stuff)
 */

/**
 * Function used to display a modal
 * @param client
 * @param contentId
 */
export async function displayModal<
    T extends ModalStepTypes[] = ModalStepTypes[],
>(
    client: NexusClient,
    { steps, metadata }: DisplayModalParamsType<T>
): Promise<ModalRpcStepsResultType<T>> {
    return (await client.request({
        method: "frak_displayModal",
        params: [steps, metadata],
    })) as ModalRpcStepsResultType<T>;
}
