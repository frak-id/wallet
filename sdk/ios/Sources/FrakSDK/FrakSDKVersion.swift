public enum FrakSDKVersion {
    // Kept in sync by hand with package.json until a release pipeline owns both.
    public static let current: String = "1.0.0-beta.3"

    // `@_spi` is Swift's twin of Android's `@InternalFrakApi`: it works here (rather than plain
    // `internal`) because this package is distributed as source through SwiftPM, so a consumer
    // still compiles against these declarations and needs an explicit opt-in to reach them.

    /// Wire plumbing for `HTTPClient`; not merchant API.
    @_spi(FrakInternal)
    public static let headerName: String = "x-frak-sdk-version"

    /// What `headerName` carries. Platform-prefixed: the version alone is identical on both
    /// SDKs, so a fleet of frozen binaries is otherwise indistinguishable on the wire.
    @_spi(FrakInternal)
    public static let headerValue: String = "ios/\(current)"

    /// Wire plumbing for `FrakSDKUI`'s page URLs; not merchant API.
    @_spi(FrakInternal)
    public static let queryParameterName: String = "sdkVersion"
}
