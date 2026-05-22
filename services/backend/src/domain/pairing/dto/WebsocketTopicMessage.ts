import type { Address, Hex } from "viem";
import type {
    StaticWalletTokenDto,
    StaticWalletWebauthnTokenDto,
} from "../../auth/models/WalletSessionDto";
import type { SignatureRejectReason } from "./SignatureRejectReason";
import type { WsSignatureKind } from "./WebsocketDirectMessage";

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
        // Forwarded as-is from the origin so the target's
        // `useSignSignatureRequest` can branch on it. Defaults to
        // `"onchain"` when omitted.
        signatureKind?: WsSignatureKind;
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
        // Hex for `signatureKind: "onchain"` (default), base64 WebAuthn
        // assertion JSON for `signatureKind: "raw-assertion"`.
        signature: Hex | string;
        // Echoes the kind the origin asked for so the receiver can pick
        // the right decoder.
        signatureKind?: WsSignatureKind;
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

/**
 * Freshly-minted webauthn session pushed to the loser side once a wallet
 * merge has settled — the loser credential is now bound to the winner
 * wallet, so the loser-side client must replace its existing session.
 */
export type WsMergeCompletedSession = {
    token: string;
    sdkJwt: { token: string; expires: number };
    wallet: StaticWalletWebauthnTokenDto;
};

/**
 * Server-emitted on both pairing topics after a cross-device wallet
 * merge settles successfully.
 *
 * The loser-side topic payload carries a `session` so the loser client
 * (the device whose credential just got absorbed into the winner wallet)
 * can swap its stale session for a freshly-minted one in a single
 * round-trip. The winner-side topic payload omits `session` — it's
 * informational so the winner UI can transition to the success state.
 */
export type WsMergeCompleted = {
    type: "merge-completed";
    payload: {
        pairingId: string;
        winner: Address;
        loser: Address;
        loserAuthenticatorId: string;
        session?: WsMergeCompletedSession;
    };
};

export type WsTopicMessage =
    | WsPartnerConnected
    | WsAuthenticated
    | WsSignatureRequest
    | WsSignatureResponse
    | WsSignatureReject
    | WsMergeCompleted
    | WsPingPong;
