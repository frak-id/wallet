import type {
    DisplayModalParamsType,
    FrakClient,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "../types";

/**
 * Function used to display a modal
 * @param client - The current Frak Client
 * @param args - The modal parameters
 * @param args.steps - The different steps of the modal
 * @param args.metadata - The metadata for the modal (customisation, language etc)
 * @group Modal Display
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
