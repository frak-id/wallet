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
    signatureRequests: Map<
        string,
        { resolve: (value: Hex) => void; reject: (reason: unknown) => void }
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
};
