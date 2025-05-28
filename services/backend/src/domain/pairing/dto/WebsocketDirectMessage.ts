import type { Hex } from "viem";

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
 * When the target send a signature rejection
 *  from target
 */
export type WsSignatureRejectRequest = {
    type: "signature-reject";
    payload: {
        // The pairing id
        pairingId: string;
        // The id of the request
        id: string;
        // The reason of the rejection
        reason: string;
    };
};

export type WsDirectMessageResponse = WsPairingCreatedResponse;

export type WsRequestDirectMessage =
    | WsPingRequest
    | WsPongRequest
    | WsSignatureRequest
    | WsSignatureResponseRequest
    | WsSignatureRejectRequest;
