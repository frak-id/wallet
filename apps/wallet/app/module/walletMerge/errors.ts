/**
 * Error codes surfaced inside the wallet-merge feature. The last three cross
 * the network verbatim from `WalletMergeOrchestrator` and are string-matched
 * in SettlingStep, so their values are a wire contract.
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
