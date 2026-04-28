/**
 * Discriminated reasons a signature request can be rejected/cancelled.
 *
 * Shared wire format between origin, target, and server-emitted rejections.
 *
 *  - `user-declined`    Target user declined the prompt on their wallet.
 *  - `user-cancelled`   Origin user closed the dApp modal / withdrew the request.
 *  - `expired`          Server TTL elapsed before the request was processed.
 */
export type SignatureRejectCode =
    | "user-declined"
    | "user-cancelled"
    | "expired";

export type SignatureRejectReason = {
    code: SignatureRejectCode;
    /**
     * Optional free-form detail useful for debugging/logging.
     * UI text should be derived from `code` only.
     */
    detail?: string;
};
