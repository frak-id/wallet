import type {
    LoginModalStepType,
    SendTransactionModalStepType,
    SiweAuthenticateModalStepType,
} from "./modal";
import type { ModalStepType } from "./modal/generic";

/**
 * Generic type of steps we will display in the modal to the end user
 */
export type ModalStepTypes =
    | LoginModalStepType
    | SiweAuthenticateModalStepType
    | SendTransactionModalStepType;

/**
 * A generic modal rpc requests
 *  - Just containing every steps
 */
export type ModalRpcRequest<Types extends ModalStepTypes[] = ModalStepTypes[]> =
    {
        steps: Types extends ModalStepType<infer Key, infer Params, infer _>[]
            ? {
                  key: Key;
                  params: Params;
              }[]
            : never;
    };

/**
 * A generic modal rpc response
 *  The modals should be a list of modal key + results (no params)
 */
export type ModalRpcResponse<
    Types extends ModalStepTypes[] = ModalStepTypes[],
> = {
    results: Types extends ModalStepType<infer Key, infer _, infer Returns>[]
        ? {
              key: Key;
              returns: Returns;
          }[]
        : never;
};

/**
 * Generic params used to display modals
 */
export type DisplayModalParamsType<TModalTypes extends ModalStepTypes[]> = {
    modal: ModalRpcRequest<TModalTypes>;
    context?: string;
};
