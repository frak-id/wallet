use serde::{Deserialize, Serialize};

/// Minimal hint stored in cloud key-value storage so the wallet can recover
/// the last known authenticator after an uninstall/reinstall.
///
/// Keep this tiny — iCloud KV caps each value at 1 KB and Block Store entries
/// at 16 KB. We only persist what is strictly needed to resume the recovery
/// flow or skip registration.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RecoveryHint {
    /// base64url-encoded WebAuthn credential id of the last authenticator.
    #[serde(rename = "lastAuthenticatorId")]
    pub last_authenticator_id: Option<String>,
    /// Hex-encoded wallet address (0x…) the authenticator belongs to.
    #[serde(rename = "lastWallet")]
    pub last_wallet: Option<String>,
    /// Unix timestamp (ms) of the last successful login on this device.
    #[serde(rename = "lastLoginAt")]
    pub last_login_at: Option<i64>,
}
