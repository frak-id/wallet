import type { GenericModalStepType, ModalStepMetadata } from "./generic";

/**
 * The final modal step type (displayed on success or dimissed)
 */
export type FinalModalStepType = GenericModalStepType<
    "final",
    {
        // Custom metadata in the case it was dismissed
        dismissedMetadata?: ModalStepMetadata["metadata"];
        // Action to perform on this final step
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
