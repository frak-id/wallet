import type { GenericModalStepType } from "./generic";

/**
 * Generic type of modal we will display to the end user
 */
export type NotRewardedModalStepType = GenericModalStepType<
    "notRewarded",
    {
        sharing?: {
            popupTitle?: string;
            text?: string;
            link?: string;
        };
    },
    object
>;
