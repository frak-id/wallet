import type { GenericModalStepType } from "./generic";

/**
 * Return type of the send transaction rpc request
 */
export type OpenInteractionSessionReturnType = Readonly<{
    startTimestamp: number;
    endTimestamp: number;
}>;

/**
 * Generic type of modal we will display to the end user
 */
export type OpenInteractionSessionModalStepType = GenericModalStepType<
    "openSession",
    object,
    OpenInteractionSessionReturnType
>;
