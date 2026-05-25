/**
 * Error codes surfaced inside the wallet-merge feature. Centralised so
 * SettlingStep's recovery switch, the strategies, and the per-step hooks
 * reference a single source of truth.
 *
 * Two groups:
 *  - `Client*` codes are thrown by code in this app (hooks, components).
 *  - `Server*` codes are surfaced verbatim from the backend (typically
 *    via `/merge/settle`); they cross the network as plain strings and
 *    we string-match them in SettlingStep to map onto recovery actions.
 *    See `services/backend/.../WalletMergeOrchestrator.ts` for the
 *    backend source-of-truth.
 */
export const MergeError = {
    AddPassKeyUserOpReverted: "MERGE_ADD_PASSKEY_USER_OP_REVERTED",
    MigrateUserOpReverted: "MERGE_MIGRATE_USER_OP_REVERTED",
    DiscoveryLocalUnexpectedCred: "MERGE_DISCOVERY_LOCAL_UNEXPECTED_CRED",
    ConsentWrongCredential: "MERGE_CONSENT_WRONG_CREDENTIAL",
    SettleFailed: "MERGE_SETTLE_FAILED",
    RemoteConsentPreviewNotReady: "MERGE_REMOTE_CONSENT_PREVIEW_NOT_READY",
    RemoteConsentHintMissing: "MERGE_REMOTE_CONSENT_HINT_MISSING",
    RemotePairingHintMissing: "MERGE_REMOTE_PAIRING_HINT_MISSING",
    RemotePairingError: "MERGE_REMOTE_PAIRING_ERROR",
    RemotePairingRetryError: "MERGE_REMOTE_PAIRING_RETRY-ERROR",

    InvalidConsent: "MERGE_INVALID_CONSENT",
    OnChainPasskeyMissing: "MERGE_ON_CHAIN_PASSKEY_MISSING",
    OnChainPasskeyMismatch: "MERGE_ON_CHAIN_PASSKEY_MISMATCH",
} as const;

export type MergeErrorCode = (typeof MergeError)[keyof typeof MergeError];
