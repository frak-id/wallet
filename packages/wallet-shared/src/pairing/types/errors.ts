import type { SignatureRejectCode } from "@frak-labs/backend-elysia/domain/pairing";

/**
 * Wire-format reject reason — re-exported from the backend's source of truth
 * so client and server cannot drift.
 */
export type {
    SignatureRejectCode,
    SignatureRejectReason,
} from "@frak-labs/backend-elysia/domain/pairing";

/**
 * Reasons surfaced by the origin pairing client when its
 * `sendSignatureRequest` promise rejects.
 *
 * Includes the wire-level reject codes plus client-only causes
 * (e.g. local socket close before the server could respond).
 */
export type PairingSignatureErrorCause =
    | SignatureRejectCode
    | "connection-lost";

/**
 * Internal failure descriptor used by the base/origin client to settle
 * pending requests on local conditions (fatal close, retry-budget, queue
 * overflow, manual reset). A wire `SignatureRejectReason` is structurally
 * compatible since its `code` is a subset of `PairingSignatureErrorCause`.
 */
export type PairingSignatureFailure = {
    code: PairingSignatureErrorCause;
    detail?: string;
};

/**
 * Error thrown / rejected by the origin pairing client.
 *
 * Use the `cause` field to render targeted UX (e.g. distinguish
 * "user cancelled" from "lost connection" in the dApp modal).
 */
export class PairingSignatureError extends Error {
    readonly cause: PairingSignatureErrorCause;
    readonly detail?: string;

    constructor(cause: PairingSignatureErrorCause, detail?: string) {
        super(
            `Pairing signature failed: ${cause}${detail ? ` (${detail})` : ""}`
        );
        this.name = "PairingSignatureError";
        this.cause = cause;
        this.detail = detail;
    }
}

/** Type guard — useful at the wagmi/dApp boundary. */
export function isPairingSignatureError(
    err: unknown
): err is PairingSignatureError {
    return err instanceof PairingSignatureError;
}
