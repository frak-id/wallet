import Foundation

/// Every failure the SDK can hand back.
public enum FrakError: Error, Sendable {
    /// A client method was reached before `Frak.initialize(_:)`.
    case notInitialized
    /// The request never reached the backend, or the response never came back.
    case network(underlying: any Error)
    /// The backend answered with a non-2xx status.
    case server(status: Int, code: String?, retryAfterSeconds: Int?)
    /// A 2xx response arrived but could not be read as the shape we expect.
    case decoding(message: String)
    /// A tracking call was made while tracking is not permitted — either because this build
    /// ships `FrakConfig(trackingEnabled: false)` or because `FrakClient.setTrackingEnabled(false)`
    /// was called at runtime. Not raised by config or reward resolution, which are deliberately
    /// ungated.
    case trackingDisabled
    /// No merchant could be identified for this app.
    case merchantResolutionFailed(reason: String)
    /// A sharing sheet was presented while one was already up.
    case alreadyPresenting
}

extension FrakError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Frak is not initialized. Call Frak.initialize(_:) before using the client."
        case .network(let underlying):
            return "Frak network request failed: \(underlying.localizedDescription)"
        case .server(let status, let code, let retryAfterSeconds):
            var message = "Frak backend returned HTTP \(status)"
            if let code {
                message += " (\(code))"
            }
            if let retryAfterSeconds {
                message += ", retry after \(retryAfterSeconds)s"
            }
            return message
        case .decoding(let message):
            return "Frak could not decode a backend response: \(message)"
        case .trackingDisabled:
            return "Frak tracking is disabled; no network request was issued."
        case .merchantResolutionFailed(let reason):
            return "Frak could not resolve a merchant: \(reason)"
        case .alreadyPresenting:
            return "A Frak sharing sheet is already presented."
        }
    }
}
