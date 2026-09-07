import Foundation

// Raw value is the domain separator prepended to signed bytes. Only what native can mint:
// `frak-ensure-v1` needs a wallet session token no native client holds (the install deep link is
// the equivalent) and there is no native SSO surface.
enum ProofOp: String {
    case install = "frak-install-v1"
    case merge = "frak-merge-v1"
}

// Never merchant-facing: exists so the reason survives to the log line.
struct InvalidProofInput: Error, CustomStringConvertible {
    let description: String
}

// Identity proof wire format, pinned to sdk/core/src/identity/fixtures/golden-proofs.json.
// Both layouts fixed-width, no length prefixes:
// message  := op_ascii + merchantId(16) + anonymousId(16) + binding(32) + ts_uint64be(8)
// envelope := version(1) + pubkey(65) + ts_uint64be(8) + signature(64)
// UUIDs signed as raw 16 bytes, never the 36-char text form.
enum ProofCodec {
    static let envelopeVersion: UInt8 = 1
    // Uncompressed SEC 1 point: 0x04 + X(32) + Y(32).
    static let publicKeyBytes = 65
    // Raw r+s, not DER.
    static let signatureBytes = 64
    private static let uuidByteCount = 16
    private static let bindingBytes = 32

    static func uuidBytes(_ value: String, label: String) throws -> Data {
        guard let uuid = UUID(uuidString: value) else {
            throw InvalidProofInput(description: "\(label) must be a UUID string, got: \(value)")
        }
        return withUnsafeBytes(of: uuid.uuid) { Data($0) }
    }

    // Lowercase always: UUID.uuidString is uppercase, and case mismatch as a string
    // breaks cache keys and the self-referral guard.
    static func uuidString(_ bytes: Data) -> String {
        let digits = Array(Hex.encode(bytes))
        return [0..<8, 8..<12, 12..<16, 16..<20, 20..<32]
            .map { String(digits[$0]) }
            .joined(separator: "-")
    }

    // Derives anonymous id from SHA-256(pubkey), with RFC-4122 v4 bits set.
    static func clientId(fromHash hash: Data) throws -> String {
        guard hash.count >= uuidByteCount else {
            throw InvalidProofInput(description: "clientId derivation needs at least 16 bytes, got \(hash.count)")
        }
        var bytes = [UInt8](hash.prefix(uuidByteCount))
        bytes[6] = bytes[6] & 0x0F | 0x40
        bytes[8] = bytes[8] & 0x3F | 0x80
        return uuidString(Data(bytes))
    }

    // binding is either empty (written as 32 zero bytes) or exactly 32.
    static func message(
        op: ProofOp,
        merchantId: String,
        anonymousId: String,
        binding: Data,
        ts: Int64
    ) throws -> Data {
        guard binding.isEmpty || binding.count == bindingBytes else {
            throw InvalidProofInput(description: "binding must be empty or 32 bytes, got \(binding.count)")
        }
        var out = Data(op.rawValue.utf8)
        out += try uuidBytes(merchantId, label: "merchantId")
        out += try uuidBytes(anonymousId, label: "anonymousId")
        out += binding.isEmpty ? Data(repeating: 0, count: bindingBytes) : binding
        out += try bigEndian(ts)
        return out
    }

    static func proof(publicKey: Data, ts: Int64, signature: Data) throws -> String {
        guard publicKey.count == publicKeyBytes else {
            throw InvalidProofInput(description: "pk must be 65 bytes, got \(publicKey.count)")
        }
        guard signature.count == signatureBytes else {
            throw InvalidProofInput(description: "sig must be 64 bytes, got \(signature.count)")
        }
        var out = Data([envelopeVersion])
        out += publicKey
        out += try bigEndian(ts)
        out += signature
        return Base64URL.encode(out)
    }

    private static func bigEndian(_ value: Int64) throws -> Data {
        guard value >= 0 else {
            throw InvalidProofInput(description: "ts must be a non-negative integer: \(value)")
        }
        return withUnsafeBytes(of: UInt64(value).bigEndian) { Data($0) }
    }
}
