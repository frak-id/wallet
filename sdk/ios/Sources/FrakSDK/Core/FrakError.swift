import Foundation

/// Every failure the SDK can hand back.
public enum FrakError: Error, Sendable {
    /// A client method was reached before `Frak.initialize(_:)`.
    case notInitialized
    /// The request never reached the backend, or the response never came back.
    case network(underlying: any Error)
    /// This resource is in a backoff window, so nothing was sent — unlike `network`, where a
    /// request was attempted. Any cached copy is served in preference to raising this.
    case backingOff(retryAfter: TimeInterval)
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
    /// A failure inside the SDK: an unexpected error that escaped an internal boundary, or a
    /// device capability it needs and cannot get. Not `decoding`, which describes a backend body.
    case internalFailure(message: String)

    /// Stable discriminator, one per case. A `switch` over ``Kind`` with a `default` survives a
    /// new case; an exhaustive `switch` over the error does not. Spelled identically on Android.
    public enum Kind: String, Sendable, Hashable, CaseIterable {
        case notInitialized
        case network
        case backingOff
        case server
        case decoding
        case trackingDisabled
        case alreadyPresenting
        case merchantResolutionFailed
        case internalFailure
    }

    public var kind: Kind {
        switch self {
        case .notInitialized: return .notInitialized
        case .network: return .network
        case .backingOff: return .backingOff
        case .server: return .server
        case .decoding: return .decoding
        case .trackingDisabled: return .trackingDisabled
        case .merchantResolutionFailed: return .merchantResolutionFailed
        case .alreadyPresenting: return .alreadyPresenting
        case .internalFailure: return .internalFailure
        }
    }
}

extension FrakError: LocalizedError {
    public var errorDescription: String? {
        switch self {
        case .notInitialized:
            return "Frak is not initialized. Call Frak.initialize(_:) before using the client."
        case .network(let underlying):
            return "Frak network request failed: \(underlying.localizedDescription)"
        case .backingOff(let retryAfter):
            return "Frak is backing off after repeated failures; retry in \(Int(retryAfter * 1000))ms."
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
        case .internalFailure(let message):
            return "Frak hit an internal error: \(message)"
        }
    }
}
