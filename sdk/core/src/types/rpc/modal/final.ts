import type { GenericModalStepType, ModalStepMetadata } from "./generic";

/**
 * The final modal step type, could be used to display sharing options or a success reward screen.
 *
 * **Input**: What type final step to display?
 * **Output**: None
 *
 * @group Modal Display
 */
export type FinalModalStepType = GenericModalStepType<
    "final",
    {
        // Custom metadata in the case it was dismissed
        dismissedMetadata?: ModalStepMetadata["metadata"];
        // Action to perform on this final step
        action: FinalActionType;
        // Do we want to auto skip this step (don't display anything to the user, once we reached it we exit)
        autoSkip?: boolean;
    },
    object
>;

/**
 * The different types of final actions we can display in the final step
 * @group Modal Display
 */
export type FinalActionType =
    | {
          key: "sharing";
          options?: {
              /**
               * @deprecated Use the top level `config.metadata.i18n` instead
               */
              popupTitle?: string;
              /**
               * @deprecated Use the top level `config.metadata.i18n` instead
               */
              text?: string;
              link?: string;
          };
      }
    | {
          key: "reward";
          options?: never;
      };
