import Foundation

/// The `fCtx` binary layout, pinned to `sdk/core/src/context/fixtures/golden-context.json`.
///
/// ```text
/// byte 0     bits[3:0] version (2) · bit[4] has clientId · bit[5] has wallet · bits[7:6] reserved, zero
/// 16 bytes   merchantId, raw UUID bytes
/// 4 bytes    timestamp, uint32 big-endian
/// 16 bytes   clientId, raw UUID bytes   — present only when bit[4]
/// 20 bytes   wallet, raw address bytes  — present only when bit[5]
/// ```
///
/// Fields are packed, not fixed-offset: with no clientId the wallet starts at byte 21, not 37.
/// Valid total lengths are 37, 41 and 57; a v1 payload is exactly 20 bytes and carries no
/// header at all, which is how the two are told apart. Nothing here throws: every input is
/// untrusted — a pasted link, a query parameter a channel mangled — so "not ours" is an
/// ordinary outcome.
enum FrakContextCodec {
    private static let version: UInt8 = 2
    private static let versionMask: UInt8 = 0x0F
    private static let flagHasClientId: UInt8 = 1 << 4
    private static let flagHasWallet: UInt8 = 1 << 5
    private static let reservedMask: UInt8 = 0xC0

    private static let headerBytes = 1
    private static let uuidBytes = 16
    private static let timestampBytes = 4
    private static let addressBytes = 20
    /// A v1 payload: one wallet address, no header.
    private static let v1Bytes = 20

    private static let maxTimestamp: Int64 = 0xFFFF_FFFF

    static func encode(_ context: FrakContext.V2) -> Data? {
        guard let merchant = parseUUID(context.merchantId),
            (0...maxTimestamp).contains(context.timestamp)
        else {
            return nil
        }
        // An empty client id is absent, not malformed; anything else non-empty must be a UUID.
        let clientIdText = context.clientId.flatMap { $0.isEmpty ? nil : $0 }
        let clientId = clientIdText.flatMap(parseUUID)
        if clientIdText != nil, clientId == nil { return nil }
        let wallet = context.wallet.flatMap(parseAddress)
        guard clientId != nil || wallet != nil else { return nil }

        var out = Data([version | (clientId != nil ? flagHasClientId : 0) | (wallet != nil ? flagHasWallet : 0)])
        out += merchant
        out += withUnsafeBytes(of: UInt32(context.timestamp).bigEndian) { Data($0) }
        if let clientId { out += clientId }
        if let wallet { out += wallet }
        return out
    }

    static func decode(_ payload: Data) -> FrakContext.V2? {
        let bytes = [UInt8](payload)
        guard bytes.count >= headerBytes + uuidBytes + timestampBytes else { return nil }

        let header = bytes[0]
        guard header & versionMask == version, header & reservedMask == 0 else { return nil }
        let hasClientId = header & flagHasClientId != 0
        let hasWallet = header & flagHasWallet != 0
        guard hasClientId || hasWallet else { return nil }

        // Exact, not minimum: a trailing byte means the sender and this reader disagree
        // about the layout, and guessing which of them is right is how attribution rots.
        let expected =
            headerBytes + uuidBytes + timestampBytes + (hasClientId ? uuidBytes : 0) + (hasWallet ? addressBytes : 0)
        guard bytes.count == expected else { return nil }

        var offset = headerBytes
        let merchantId = ProofCodec.uuidString(Data(bytes[offset..<offset + uuidBytes]))
        offset += uuidBytes
        let timestamp = bytes[offset..<offset + timestampBytes].reduce(Int64(0)) { $0 << 8 | Int64($1) }
        offset += timestampBytes

        var clientId: String?
        if hasClientId {
            clientId = ProofCodec.uuidString(Data(bytes[offset..<offset + uuidBytes]))
            offset += uuidBytes
        }
        var wallet: String?
        if hasWallet {
            wallet = "0x" + Hex.encode(bytes[offset..<offset + addressBytes])
        }

        return FrakContext.V2(merchantId: merchantId, timestamp: timestamp, clientId: clientId, wallet: wallet)
    }

    static func compress(_ context: FrakContext.V2) -> String? {
        encode(context).map(Base64URL.encode)
    }

    static func decompress(_ value: String) -> FrakContext? {
        guard !value.isEmpty, let bytes = Base64URL.decode(value) else { return nil }
        if bytes.count == v1Bytes {
            return .v1(wallet: "0x" + Hex.encode(bytes))
        }
        return decode(bytes).map(FrakContext.v2)
    }

    private static func parseUUID(_ value: String) -> Data? {
        try? ProofCodec.uuidBytes(value, label: "uuid")
    }

    /// Shape only, never an EIP-55 checksum: the SDK is not the authority on which
    /// addresses exist, and rejecting a valid lowercase address would break real links.
    private static func parseAddress(_ value: String) -> Data? {
        guard value.count == 2 + addressBytes * 2, value.hasPrefix("0x") else { return nil }
        return Hex.decode(String(value.dropFirst(2)))
    }
}
