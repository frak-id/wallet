import Foundation

/// Turns a `GET /user/merchant/resolve` body into a `FrakResolvedConfig`.
enum ResolvedConfigDecoder {
    private struct Wire: Decodable {
        let merchantId: String
        let name: String
        let domain: String
        let sdkConfig: ResolvedSdkConfig?
    }

    static func decode(_ body: Data) throws -> FrakResolvedConfig {
        let wire = try JSONDecoding.decode(Wire.self, from: body)
        let sdkConfig = wire.sdkConfig
        return FrakResolvedConfig(
            merchantId: wire.merchantId,
            name: wire.name,
            domain: wire.domain,
            lang: sdkConfig?.lang,
            currency: sdkConfig?.currency,
            hidden: sdkConfig?.hidden ?? false,
            sdkConfig: sdkConfig
        )
    }
}
