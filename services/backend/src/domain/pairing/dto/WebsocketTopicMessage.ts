import type { Hex } from "viem";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";
import type { SignatureRejectReason } from "./SignatureRejectReason";

/**
 * When the origin send the request to the target
 */
export type WsSignatureRequest = {
    type: "signature-request";
    payload: {
        // The pairing id
        pairingId: string;
        // The id of the request
        id: string;
        // The request
        request: Hex;
        // Some optional context
        context?: object;
        // The name of the partner device
        partnerDeviceName: string;
    };
};

/**
 * When the target is paired to the origin, we can emit the authenticated message
 */
export type WsAuthenticated = {
    type: "authenticated";
    payload: {
        token: string;
        sdkJwt: {
            token: string;
            expires: number;
        };
        wallet: StaticWalletTokenDto;
    };
};

/**
 * When the partner is connected
 */
export type WsPartnerConnected = {
    type: "partner-connected";
    payload: {
        pairingId: string;
        deviceName: string;
    };
};

/**
 * When the target send back the response to the origin
 */
export type WsSignatureResponse = {
    type: "signature-response";
    payload: {
        pairingId: string;
        id: string;
        signature: Hex;
    };
};

/**
 * When a signature request is terminated.
 *
 * Sent in three scenarios:
 *   - Target declined a prompt: target → server → origin
 *   - Origin cancelled its own request: origin → server → target
 *   - Server-side TTL expiry: server → origin and/or target
 */
export type WsSignatureReject = {
    type: "signature-reject";
    payload: {
        pairingId: string;
        id: string;
        reason: SignatureRejectReason;
    };
};

/**
 * Ping pong between the origin and the target
 *  - origin send `ping`
 *  - target send `pong`
 */
export type WsPingPong = {
    type: "ping" | "pong";
    payload: {
        // The pairing id
        pairingId: string;
    };
};

export type WsTopicMessage =
    | WsPartnerConnected
    | WsAuthenticated
    | WsSignatureRequest
    | WsSignatureResponse
    | WsSignatureReject
    | WsPingPong;
