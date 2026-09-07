import Foundation

/// Config resolution. Obtained from `FrakClient.config`.
public struct ConfigAPI: Sendable {
    let core: DefaultFrakClient

    /// The most recently resolved config, or nil before the first resolve.
    public var current: FrakResolvedConfig? {
        get async { await core.currentConfig }
    }

    /// Multicast. Emits on a network resolve that changed the config, and replays the last such
    /// value; a warm start served from a fresh cache emits nothing, so read `current` first.
    public var updates: AsyncStream<FrakResolvedConfig> {
        get async { await core.configUpdates }
    }

    /// Stale-while-revalidate cache; forceRefresh still respects failure backoff.
    public func resolve(forceRefresh: Bool = false) async throws -> FrakResolvedConfig {
        try await core.resolveConfig(forceRefresh: forceRefresh)
    }
}
