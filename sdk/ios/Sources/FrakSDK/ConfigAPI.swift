import Foundation

/// Config resolution. Obtained from `FrakClient.config`.
public struct ConfigAPI: Sendable {
    let core: DefaultFrakClient

    /// The most recently resolved config, or nil before the first resolve.
    public var current: FrakResolvedConfig? {
        get async { await core.currentConfig }
    }

    /// Multicast, replays latest value to new subscribers.
    public var updates: AsyncStream<FrakResolvedConfig> {
        get async { await core.configUpdates }
    }

    /// Stale-while-revalidate cache; forceRefresh still respects failure backoff.
    public func resolve(forceRefresh: Bool = false) async throws -> FrakResolvedConfig {
        try await core.resolveConfig(forceRefresh: forceRefresh)
    }
}
