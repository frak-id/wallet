import type { GenericModalStepType } from "./generic";

/**
 * Generic type of modal we will display to the end user
 */
export type SuccessModalStepType = GenericModalStepType<
    "success",
    {
        sharingLink?: {
            baseLink?: string;
        };
    },
    object
>;
