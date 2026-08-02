/// Who a share link came from, as carried in its `fCtx` query parameter.
public enum FrakContext: Sendable, Hashable {
    // Legacy, decode-only: names only a wallet address.
    case v1(wallet: String)
    case v2(V2)

    public struct V2: Sendable, Hashable {
        public let merchantId: String
        // Unix seconds, narrows to 32 bits on the wire.
        public let timestamp: Int64
        // Nil when shared from a wallet.
        public let clientId: String?
        // Nil when there is no wallet.
        public let wallet: String?

        public init(merchantId: String, timestamp: Int64, clientId: String? = nil, wallet: String? = nil) {
            self.merchantId = merchantId
            self.timestamp = timestamp
            self.clientId = clientId
            self.wallet = wallet
        }
    }
}
