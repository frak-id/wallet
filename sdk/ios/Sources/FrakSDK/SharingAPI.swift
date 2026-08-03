import Foundation

/// Share link construction. Obtained from `FrakClient.sharing`.
public struct SharingAPI: Sendable {
    let core: DefaultFrakClient

    /// Nil (not throw) when there's no identity to build from. No network request of its own.
    public func buildLink(_ request: SharingRequest) async -> String? {
        await core.buildSharingLink(request)
    }
}
