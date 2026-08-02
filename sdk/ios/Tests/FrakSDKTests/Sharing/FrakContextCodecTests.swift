import Foundation
import Testing

@testable import FrakSDK

/// The `fCtx` codec, asserted against the cross-platform corpus. The corpus is the
/// authority: TypeScript, Kotlin and Swift are pinned to it, not to each other.
@Suite("FrakContextCodec")
struct FrakContextCodecTests {
    private static func corpus() throws -> GoldenFixtures.Corpus {
        try GoldenFixtures.load(GoldenFixtures.contextCodec)
    }

    private static func contextOf(_ payload: [String: Any]) throws -> FrakContext.V2 {
        guard let merchantId = payload["m"] as? String, let timestamp = payload["t"] as? Int else {
            throw GoldenFixtures.CorpusError(description: "context fixture payload has no m/t: \(payload)")
        }
        return FrakContext.V2(
            merchantId: merchantId,
            timestamp: Int64(timestamp),
            clientId: payload["c"] as? String,
            wallet: payload["w"] as? String
        )
    }

    private static func encodeFixtures() throws -> [(name: String, input: [String: Any], expected: [String: Any])] {
        try corpus().entries
            .filter { $0["kind"] as? String == "encode" }
            .map { entry in
                guard let name = entry["name"] as? String,
                    let input = entry["input"] as? [String: Any],
                    let expected = entry["expected"] as? [String: Any]
                else {
                    throw GoldenFixtures.CorpusError(description: "malformed encode fixture: \(entry)")
                }
                return (name, input, expected)
            }
    }

    @Test("encodes every fixture to the expected bytes and wire string")
    func encodesEveryFixture() throws {
        let fixtures = try Self.encodeFixtures()
        for fixture in fixtures {
            let context = try Self.contextOf(fixture.input)
            let bytes = try #require(FrakContextCodec.encode(context), "\(fixture.name)")
            #expect(bytes.count == fixture.expected["byteLength"] as? Int, "\(fixture.name)")
            #expect(Hex.encode(bytes) == fixture.expected["hex"] as? String, "\(fixture.name)")

            let compressed = fixture.expected["base64url"] as? String
            #expect(FrakContextCodec.compress(context) == compressed, "\(fixture.name)")
            #expect(compressed?.count == fixture.expected["base64urlLength"] as? Int, "\(fixture.name)")
        }
        // A loop over an empty corpus passes while proving nothing.
        #expect(!fixtures.isEmpty)
    }

    @Test("decodes every fixture back to its canonical form")
    func decodesEveryFixture() throws {
        let fixtures = try Self.encodeFixtures()
        #expect(!fixtures.isEmpty)
        for fixture in fixtures {
            let hex = try #require(fixture.expected["hex"] as? String)
            let decoded = FrakContextCodec.decode(try #require(Hex.decode(hex)))
            let canonical = try Self.contextOf(try #require(fixture.expected["decoded"] as? [String: Any]))
            #expect(decoded == canonical, "\(fixture.name)")
        }
    }

    @Test("round-trips every fixture through the wire string")
    func roundTripsThroughTheWireString() throws {
        let fixtures = try Self.encodeFixtures()
        #expect(!fixtures.isEmpty)
        for fixture in fixtures {
            let wire = try #require(fixture.expected["base64url"] as? String)
            let canonical = try Self.contextOf(try #require(fixture.expected["decoded"] as? [String: Any]))
            #expect(FrakContextCodec.decompress(wire) == .v2(canonical), "\(fixture.name)")
        }
    }

    @Test("refuses every rejection fixture, in the direction it names")
    func refusesEveryRejectionFixture() throws {
        var checked = 0
        for entry in try Self.corpus().entries where entry["kind"] as? String == "reject" {
            let name = try #require(entry["name"] as? String)
            switch entry["direction"] as? String {
            case "encode":
                let input = try #require(entry["input"] as? [String: Any])
                // A fractional timestamp cannot be expressed against an `Int64` parameter.
                guard let timestamp = input["t"] as? Int else { continue }
                let context = FrakContext.V2(
                    merchantId: (input["m"] as? String) ?? "",
                    timestamp: Int64(timestamp),
                    clientId: input["c"] as? String,
                    wallet: input["w"] as? String
                )
                #expect(FrakContextCodec.encode(context) == nil, "\(name)")
            case "decode":
                let bytes = try #require(Hex.decode(try #require(entry["inputHex"] as? String)))
                #expect(FrakContextCodec.decode(bytes) == nil, "\(name)")
            case "decompress":
                let wire = try #require(entry["inputBase64url"] as? String)
                #expect(FrakContextCodec.decompress(wire) == nil, "\(name)")
            default:
                throw GoldenFixtures.CorpusError(description: "rejection fixture names no direction: \(name)")
            }
            checked += 1
        }
        #expect(checked > 0)
    }

    @Test("reads a v1 payload the v2 decoder refuses")
    func readsAV1Payload() throws {
        let fixture = try #require(try Self.corpus().named("reject-decode-v1-length-buffer"))
        let bytes = try #require(Hex.decode(try #require(fixture["inputHex"] as? String)))
        let wallet = try #require((fixture["decompressesTo"] as? [String: Any])?["r"] as? String)

        #expect(FrakContextCodec.decode(bytes) == nil)
        #expect(FrakContextCodec.decompress(Base64URL.encode(bytes)) == .v1(wallet: wallet))
    }

    @Test("rejects a negative timestamp the corpus cannot express")
    func rejectsANegativeTimestamp() {
        let context = FrakContext.V2(
            merchantId: "550e8400-e29b-41d4-a716-446655440000",
            timestamp: -1,
            clientId: "550e8400-e29b-41d4-a716-446655440001"
        )
        #expect(FrakContextCodec.encode(context) == nil)
    }
}
