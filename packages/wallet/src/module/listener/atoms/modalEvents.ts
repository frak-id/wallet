import type {
    IFrameRpcSchema,
    ModalRpcRequest,
    RpcResponse,
} from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

/**
 * The currently displayed listener request
 */
export const modalDisplayedRequestAtom = atom<{
    modal: ModalRpcRequest;
    context?: string;
    emitter: (
        response: RpcResponse<IFrameRpcSchema, "frak_displayModal">
    ) => Promise<void>;
} | null>(null);
