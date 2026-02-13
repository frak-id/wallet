import type { Hex } from "viem";
import type { StaticWalletTokenDto } from "../../auth/models/WalletSessionDto";

/**
 * When the origin send the request to the target
 */
type WsSignatureRequest = {
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
type WsAuthenticated = {
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
type WsPartnerConnected = {
    type: "partner-connected";
    payload: {
        pairingId: string;
        deviceName: string;
    };
};

/**
 * When the target send back the response to the origin
 */
type WsSignatureResponse = {
    type: "signature-response";
    payload: {
        pairingId: string;
        id: string;
        signature: Hex;
    };
};

/**
 * When the target send a signature rejection
 */
type WsSignatureReject = {
    type: "signature-reject";
    payload: {
        pairingId: string;
        id: string;
        reason: string;
    };
};

/**
 * Ping pong between the origin and the target
 *  - origin send `ping`
 *  - target send `pong`
 */
type WsPingPong = {
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
