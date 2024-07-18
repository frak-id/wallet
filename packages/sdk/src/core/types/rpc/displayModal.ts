import type {
    LoginModalStepType,
    SendTransactionModalStepType,
    SiweAuthenticateModalStepType,
} from "./modal";

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
 *
 *  todo: fix types
 */
export type ModalRpcRequest<Types extends ModalStepTypes[] = ModalStepTypes[]> =
    {
        steps: {
            [K in keyof Types]: {
                key: Types[K]["key"];
                params: Types[K]["params"];
            };
        };
    };

/**
 * A generic modal rpc response
 *  The modals should be a list of modal key + results (no params)
 */
export type ModalRpcResponse<
    Types extends ModalStepTypes[] = ModalStepTypes[],
> = {
    results: {
        [K in keyof Types]: {
            key: Types[K]["key"];
            returns: Types[K]["returns"];
        };
    };
};

/**
 * Generic params used to display modals
 */
export type DisplayModalParamsType<TModalTypes extends ModalStepTypes[]> = {
    modal: ModalRpcRequest<TModalTypes>;
    context?: string;
};
