use serde::{Deserialize, Serialize};

/// Identify the current user in Crashlytics. We pass the wallet address so
/// crashes can be correlated across sessions / devices for the same user.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SetUserIdArgs {
    #[serde(rename = "userId")]
    pub user_id: String,
}

/// Custom key/value pair attached to subsequent crash reports.
///
/// Crashlytics stores up to 64 keys per app; values are coerced to strings on
/// the JS side before reaching the native plugin so we don't need a tagged
/// union here.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SetKeyArgs {
    pub key: String,
    pub value: String,
}

/// Breadcrumb message that will be attached to the next crash report.
///
/// Crashlytics keeps the last 64 KB of logs so prefer short, structured
/// messages.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct LogArgs {
    pub message: String,
}

/// Non-fatal error captured manually (e.g. a caught exception).
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RecordErrorArgs {
    /// Short error class — surfaced as the issue title in Crashlytics.
    pub name: String,
    /// Human-readable message — surfaced as the issue subtitle.
    pub message: String,
    /// Optional pre-rendered stack trace; native side will attach it as a
    /// custom log entry on the recorded error.
    #[serde(default)]
    pub stack: Option<String>,
}

/// Toggle Crashlytics collection at runtime. Useful for an opt-out setting
/// or for muting reports during automated tests.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct SetCollectionEnabledArgs {
    pub enabled: bool,
}
