import type {
    LoginModalType,
    SendTransactionModalType,
    SiweAuthenticateModalType,
} from "./modal";
import type { GenericModalType } from "./modal/generic";

/**
 * Generic type of modal we will display to the end user
 */
export type ModalTypes =
    | LoginModalType
    | SiweAuthenticateModalType
    | SendTransactionModalType;

/**
 * A generic modal rpc requests
 *  The modals should be a list of modal key + params (no results)
 */
export type ModalRpcRequest<Types extends ModalTypes[] = ModalTypes[]> =
    Types extends GenericModalType<infer Key, infer Params, infer _>[]
        ? {
              key: Key;
              params: Params;
          }[]
        : never;

/**
 * A generic modal rpc response
 *  The modals should be a list of modal key + results (no params)
 */
export type ModalRpcResponse<Types extends ModalTypes[] = ModalTypes[]> =
    Types extends GenericModalType<infer Key, infer _, infer Returns>[]
        ? {
              key: Key;
              returns: Returns;
          }[]
        : never;

/**
 * Generic params used to display modals
 */
export type DisplayModalParamsType<TModalTypes extends ModalTypes[]> = {
    modal: ModalRpcRequest<TModalTypes>;
    context?: string;
};
