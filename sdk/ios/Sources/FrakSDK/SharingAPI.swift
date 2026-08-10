import Foundation

/// Share link construction. Obtained from `FrakClient.sharing`.
public struct SharingAPI: Sendable {
    let core: DefaultFrakClient

    /// Builds a share link for `request`.
    ///
    /// Returns nil only when there is nothing to link to: the request carried no link, none of its
    /// products did, and neither the resolved config nor `FrakMetadata.homepageLink` supplies one.
    /// That is answerable without a network round trip, so it is an absence rather than a failure.
    ///
    /// - Throws: `FrakError` when a link could have been built but could not be: tracking is
    ///   disabled, the device refused key material, or no merchant could be resolved.
    public func buildLink(_ request: SharingRequest) async throws -> String? {
        try await core.buildSharingLink(request)
    }
}
