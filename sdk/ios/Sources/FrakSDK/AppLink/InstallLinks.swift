enum InstallLinks {
    // Single App Store listing for all stages; dev build installs out of band.
    private static let appStoreURL = "https://apps.apple.com/app/id6740261164"

    /// Links this installation's anonymous id to the user's wallet.
    static func deepLink(scheme: String, merchantId: String, anonymousId: String) -> String {
        "\(scheme)://install?m=\(PercentEncoding.encode(merchantId))&a=\(PercentEncoding.encode(anonymousId))"
    }

    // No identity carried: iOS has no Play-style install referrer.
    static func appStore() -> String {
        appStoreURL
    }
}
