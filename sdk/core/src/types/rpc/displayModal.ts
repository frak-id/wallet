import type { FullInteractionTypesKey } from "../../constants/interactionTypes";
import type { I18nConfig } from "../config";
import type {
    FinalModalStepType,
    LoginModalStepType,
    OpenInteractionSessionModalStepType,
    SendTransactionModalStepType,
    SiweAuthenticateModalStepType,
} from "./modal";

/**
 * Generic type of steps we will display in the modal to the end user
 * @group Modal Display
 */
export type ModalStepTypes =
    | LoginModalStepType
    | SiweAuthenticateModalStepType
    | SendTransactionModalStepType
    | OpenInteractionSessionModalStepType
    | FinalModalStepType;

/**
 * Type for the result of a modal request
 * Just the `returns` type of each `ModalStepTypes`
 * @typeParam T - The list of modal steps we expect to have in the modal
 * @group Modal Display
 * @group RPC Schema
 */
export type ModalRpcStepsResultType<
    T extends ModalStepTypes[] = ModalStepTypes[],
> = {
    [K in T[number]["key"]]: Extract<T[number], { key: K }>["returns"];
};

/**
 * Type for the RPC input of a modal
 * Just the `params` type of each `ModalStepTypes`
 * @typeParam T - The list of modal steps we expect to have in the modal
 * @group Modal Display
 * @group RPC Schema
 */
export type ModalRpcStepsInput<T extends ModalStepTypes[] = ModalStepTypes[]> =
    {
        [K in T[number]["key"]]?: Extract<T[number], { key: K }>["params"];
    };

/**
 * RPC metadata for the modal, used on top level modal configuration
 * @group Modal Display
 * @group RPC Schema
 */
export type ModalRpcMetadata = {
    header?: {
        title?: string;
        icon?: string;
    };
    targetInteraction?: FullInteractionTypesKey;
    /**
     * Some i18n override for the displayed modal (i.e. update the displayed text only for this modal)
     */
    i18n?: I18nConfig;
} & (
    | {
          isDismissible: true;
          /**
           * @deprecated Use `config.customizations.i18n` or `metadata.i18n` instead
           */
          dismissActionTxt?: string;
      }
    | {
          isDismissible?: false;
          dismissActionTxt?: never;
      }
);

/**
 * Params used to display a modal
 * @typeParam T - The list of modal steps we expect to have in the modal
 * @group Modal Display
 */
export type DisplayModalParamsType<T extends ModalStepTypes[]> = {
    steps: ModalRpcStepsInput<T>;
    metadata?: ModalRpcMetadata;
};
