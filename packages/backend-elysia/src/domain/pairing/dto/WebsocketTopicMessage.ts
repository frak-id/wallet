import type { Hex } from "viem";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";

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
        // The pairing id
        pairingId: string;
        // The id of the request
        id: string;
        // The signature response
        signature: Hex;
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
    | WsPingPong;
