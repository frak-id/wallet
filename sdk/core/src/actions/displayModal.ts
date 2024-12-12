import type {
    DisplayModalParamsType,
    FrakClient,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "../types";

/**
 * Function used to display a modal
 * @param client
 * @param args
 */
export async function displayModal<
    T extends ModalStepTypes[] = ModalStepTypes[],
>(
    client: FrakClient,
    { steps, metadata }: DisplayModalParamsType<T>
): Promise<ModalRpcStepsResultType<T>> {
    return (await client.request({
        method: "frak_displayModal",
        params: [steps, client.config.metadata.name, metadata],
    })) as ModalRpcStepsResultType<T>;
}
