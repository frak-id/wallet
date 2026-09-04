import Foundation

/// Inbound referral links and the wallet app handoff. Obtained from `FrakClient.appLink`.
public struct AppLinkAPI: Sendable {
    let core: DefaultFrakClient

    /// - Returns: whether the link carried a Frak referral context. Not a "stop routing"
    ///   signal — still navigate to the URL either way.
    @discardableResult
    public func handleReferral(_ url: String) async -> Bool {
        await core.handleReferralLink(url)
    }

    @discardableResult
    public func handleReferral(_ url: URL) async -> Bool {
        await core.handleReferralLink(url.absoluteString)
    }

    // Requires FrakConfig.env's walletScheme in LSApplicationQueriesSchemes to answer true.
    public func isFrakAppInstalled() async -> Bool {
        await core.isFrakAppInstalled()
    }

    /// Whether the wallet's scheme is declared in `LSApplicationQueriesSchemes` at all.
    /// `FrakSDKUI`'s install detector uses this to decide whether to poll; not merchant API.
    @_spi(FrakInternal)
    public func walletSchemeStatus() async -> ProbeStatus {
        await core.walletSchemeStatus()
    }

    public func openFrakApp() async -> OpenAppResult {
        await core.openFrakApp()
    }

    /// The wallet's hosted install page for this device.
    ///
    /// Not the store listing — `openFrakApp()` handles that handoff itself. This page shows the
    /// install code that carries attribution across an install, plus the store link, and it
    /// carries a freshly minted `frak-install-v1` proof. The sharing sheet navigates to it in
    /// place, so the user never leaves the merchant app to reach it.
    ///
    /// - Throws: `FrakError` when the page cannot be minted: tracking is disabled, the device
    ///   refused key material, or no merchant could be resolved.
    public func installPageURL(returnScheme: String, sessionId: String) async throws -> String {
        try await core.installPageURL(returnScheme: returnScheme, sessionId: sessionId)
    }
}
