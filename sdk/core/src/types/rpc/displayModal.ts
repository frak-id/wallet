import type {
    FinalModalStepType,
    LoginModalStepType,
    OpenInteractionSessionModalStepType,
    SendTransactionModalStepType,
    SiweAuthenticateModalStepType,
} from "./modal";

/**
 * Generic type of steps we will display in the modal to the end user
 */
export type ModalStepTypes =
    | LoginModalStepType
    | SiweAuthenticateModalStepType
    | SendTransactionModalStepType
    | OpenInteractionSessionModalStepType
    | FinalModalStepType;

/**
 * Type for the result of a modal request
 */
export type ModalRpcStepsResultType<
    T extends ModalStepTypes[] = ModalStepTypes[],
> = {
    [K in T[number]["key"]]: Extract<T[number], { key: K }>["returns"];
};

/**
 * Type for the RPC input of a modal
 */
export type ModalRpcStepsInput<T extends ModalStepTypes[] = ModalStepTypes[]> =
    {
        [K in T[number]["key"]]?: Extract<T[number], { key: K }>["params"];
    };

/**
 * RPC metadata for the modal
 */
export type ModalRpcMetadata = Readonly<
    {
        header?: {
            title?: string;
            icon?: string;
        };
        context?: string;
        lang?: "en" | "fr";
    } & (
        | {
              isDismissible: true;
              dismissActionTxt?: string;
          }
        | {
              isDismissible?: false;
              dismissActionTxt?: never;
          }
    )
>;

/**
 * Generic params used to display modals
 */
export type DisplayModalParamsType<T extends ModalStepTypes[]> = {
    steps: ModalRpcStepsInput<T>;
    metadata?: ModalRpcMetadata;
};
