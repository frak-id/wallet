import type { Hex } from "viem";

export type BasePairingState = {
    partnerDevice: string | null;
    status: "idle" | "connecting" | "paired" | "retry-error";
    closeInfo?: {
        code: number;
        reason: string;
    };
};

export type OriginPairingState = BasePairingState & {
    pairing?: {
        id: string;
        code: string;
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
