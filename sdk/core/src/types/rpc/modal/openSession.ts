import type { GenericModalStepType } from "./generic";

/**
 * Return type of the open session modal step
 * @inline
 * @ignore
 */
export type OpenInteractionSessionReturnType = {
    startTimestamp: number;
    endTimestamp: number;
};

/**
 * The open interaction session step for a Modal
 *
 * **Input**: None
 * **Output**: The interactions session period (start and end timestamp)
 *
 * @group Modal Display
 */
export type OpenInteractionSessionModalStepType = GenericModalStepType<
    "openSession",
    object,
    OpenInteractionSessionReturnType
>;
