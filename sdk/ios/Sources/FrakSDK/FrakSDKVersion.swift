public enum FrakSDKVersion {
    // Kept in sync by hand with package.json until a release pipeline owns both.
    public static let current: String = "0.0.1"

    public static let headerName: String = "x-frak-sdk-version"

    public static let queryParameterName: String = "sdkv"
}
