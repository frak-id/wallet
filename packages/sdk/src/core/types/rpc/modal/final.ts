import type { GenericModalStepType } from "./generic";

/**
 * The final modal step type (displayed on success)
 */
export type FinalSuccessModalStepType = GenericModalStepType<
    "success",
    {
        action: FinalActionType;
    },
    object
>;

/**
 * The final modal step type (displayed on dismiss)
 */
export type FinalDismissedModalStepType = GenericModalStepType<
    "dismissed",
    {
        action: FinalActionType;
    },
    object
>;

export type FinalActionType =
    | {
          key: "sharing";
          options?: {
              popupTitle?: string;
              text?: string;
              link?: string;
          };
      }
    | {
          key: "reward";
          options?: never;
      };
