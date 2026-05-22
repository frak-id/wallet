import type { Hex } from "viem";
import type { SignatureRejectReason } from "./SignatureRejectReason";

/**
 * Discriminates how the target should produce and how the origin should
 * interpret the value carried back in `signature-response.signature`.
 *
 * - `"onchain"` (default, omitted on the wire for legacy clients): target
 *   wraps a WebAuthn assertion with `formatSignature` and returns it as a
 *   Hex blob ready to plug into a userOp / smart-account validator.
 * - `"raw-assertion"`: target returns the raw base64-encoded WebAuthn
 *   assertion JSON (`{id, response: {metadata, signature}}`), parseable by
 *   `WebAuthNService.verifyConsentSignature`. Used by the cross-device
 *   wallet merge to ferry the loser's deterministic merge-consent
 *   assertion back to the requester without an on-chain wrapping step.
 */
export type WsSignatureKind = "onchain" | "raw-assertion";

/**
 * When a pairing is initiated by the origin
 *
 * `originResumeToken` is a short-lived JWT that authorises the origin to
 * call `action=resume` after a transient WS close. It is sent ONLY over
 * this direct response — never broadcast on the topic, never returned by
 * the public `/find/:id` endpoint — so possessing the pairingId+code is
 * not sufficient to hijack a resume.
 */
export type WsPairingCreatedResponse = {
    type: "pairing-initiated";
    payload: {
        pairingId: string;
        pairingCode: string;
        originResumeToken: string;
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
        // How the response should be shaped. Defaults to "onchain" when
        // omitted (legacy clients).
        signatureKind?: WsSignatureKind;
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
        // The signature response. Hex for `signatureKind: "onchain"`
        // (default), base64 WebAuthn assertion JSON for
        // `signatureKind: "raw-assertion"`.
        signature: Hex | string;
        // Echoes the kind from the matching `signature-request` so the
        // origin can pick the right decoder without consulting its own
        // bookkeeping. Optional for legacy `onchain` clients.
        signatureKind?: WsSignatureKind;
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
