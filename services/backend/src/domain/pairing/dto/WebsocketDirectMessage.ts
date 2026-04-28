import type { Hex } from "viem";
import type { SignatureRejectReason } from "./SignatureRejectReason";

/**
 * When a pairing is initiated by the origin
 */
export type WsPairingCreatedResponse = {
    type: "pairing-initiated";
    payload: {
        pairingId: string;
        pairingCode: string;
    };
};

/**
 * When the origin send a ping request
 *  from origin
 */
export type WsPingRequest = {
    type: "ping";
};

/**
 * When the origin want to send a signature request
 *  from origin
 */
export type WsSignatureRequest = {
    type: "signature-request";
    payload: {
        // The id of the request
        id: string;
        // The request
        request: Hex;
        // Some optional context
        context?: object;
    };
};

/**
 * When the target want to send a pong response
 *  from target
 */
export type WsPongRequest = {
    type: "pong";
    payload: {
        // The pairing id on which the pong is sent
        pairingId: string;
    };
};

/**
 * When the target send a signature response
 *  from target
 */
export type WsSignatureResponseRequest = {
    type: "signature-response";
    payload: {
        // The pairing id
        pairingId: string;
        // The id of the request
        id: string;
        // The signature response
        signature: Hex;
    };
};
/**
 * When either side sends a signature rejection / cancellation.
 *
 * Bidirectional: target uses it to decline a sign prompt, origin uses it
 * to cancel a request the user dismissed before signing. Server's response
 * is symmetric — delete the DB row, forward to the OPPOSITE topic.
 */
export type WsSignatureRejectRequest = {
    type: "signature-reject";
    payload: {
        // The id of the request
        id: string;
        // The reason of the rejection (typed)
        reason: SignatureRejectReason;
        // Optional pairing id (target must include it; origin can omit it,
        // server resolves it from the wallet token)
        pairingId?: string;
    };
};

export type WsDirectMessageResponse = WsPairingCreatedResponse;

export type WsRequestDirectMessage =
    | WsPingRequest
    | WsPongRequest
    | WsSignatureRequest
    | WsSignatureResponseRequest
    | WsSignatureRejectRequest;
