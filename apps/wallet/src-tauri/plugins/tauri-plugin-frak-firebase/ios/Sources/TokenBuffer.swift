import Foundation

/// Thread-safe in-memory buffer for the latest FCM token.
///
/// Solves the cold-start race condition where `MessagingDelegate.didReceiveRegistrationToken`
/// fires before JS event listeners are attached. The `getToken` command reads from this buffer
/// as a fallback when `Messaging.messaging().token` fails.
///
/// Vendored verbatim from `srod/tauri-plugin-fcm` (commit b9d4d186).
final class TokenBuffer {
    private let lock = NSLock()
    private var latestToken: String?

    /// Store the latest FCM token. Thread-safe.
    func store(token: String) {
        lock.lock()
        defer { lock.unlock() }
        latestToken = token
    }

    /// Return the buffered token. Does NOT clear it — the token remains available
    /// for subsequent reads until overwritten by a new store().
    /// Thread-safe.
    func consume() -> String? {
        lock.lock()
        defer { lock.unlock() }
        return latestToken
    }
}

/// Thread-safe buffer for APNs registration errors.
///
/// When `didFailToRegisterForRemoteNotificationsWithError` fires, the error is
/// stored here. `getToken()` checks this buffer when no token is available and
/// rejects with the APNs error instead of a generic "FCM token not available"
/// message. Cleared automatically when a successful token arrives.
final class RegistrationErrorBuffer {
    private let lock = NSLock()
    private var lastError: String?

    /// Store an APNs registration error. Thread-safe.
    func store(error: String) {
        lock.lock()
        defer { lock.unlock() }
        lastError = error
    }

    /// Consume and clear the buffered error. Thread-safe.
    func consume() -> String? {
        lock.lock()
        defer { lock.unlock() }
        let error = lastError
        lastError = nil
        return error
    }

    /// Clear any buffered error (e.g. when a token arrives). Thread-safe.
    func clear() {
        lock.lock()
        defer { lock.unlock() }
        lastError = nil
    }
}
