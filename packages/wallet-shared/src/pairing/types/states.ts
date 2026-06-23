import type { WsSignatureKind } from "@frak-labs/backend-elysia/domain/pairing";
import type { Hex } from "viem";

export type BasePairingState = {
    partnerDevice: string | null;
    status: "idle" | "connecting" | "paired" | "retry-error" | "error";
    closeInfo?: {
        code: number;
        reason: string;
    };
};

export type OriginPairingState = BasePairingState & {
    pairing?: {
        id: string;
        code: string;
        /**
         * Short-lived JWT issued by the server in `pairing-initiated`. Required
         * to call `action=resume` after a transient WS close. Persisted along
         * with `id`/`code` so a tab refresh can resume the in-flight pairing.
         */
        originResumeToken: string;
    };
    /**
     * Pending signature requests waiting on the paired target. The resolved
     * value is `Hex` for the default `signatureKind: "onchain"` flow and a
     * base64-encoded WebAuthn assertion JSON `string` for the cross-device
     * merge `signatureKind: "raw-assertion"` flow. Callers narrow off the
     * `sendSignatureRequest` overload that they invoked.
     */
    signatureRequests: Map<
        string,
        {
            resolve: (value: Hex | string) => void;
            reject: (reason: unknown) => void;
        }
    >;
};

export type TargetPairingState = BasePairingState & {
    pairingIdState: Map<string, TargetPairingIdState>;
    pendingSignatures: Map<string, TargetPairingPendingSignature>;
};

export type TargetPairingIdState = {
    name: string;
    lastLive: number;
};

export type TargetPairingPendingSignature = {
    id: string;
    pairingId: string;
    request: Hex;
    context?: object;
    from: string;
    /**
     * Forwarded from the origin's `signature-request`. When `"raw-assertion"`,
     * `useSignSignatureRequest` produces a base64 WebAuthn assertion JSON
     * (consumed by `WebAuthNService.verifyConsentSignature`) instead of the
     * default on-chain Hex blob.
     */
    signatureKind?: WsSignatureKind;
};
