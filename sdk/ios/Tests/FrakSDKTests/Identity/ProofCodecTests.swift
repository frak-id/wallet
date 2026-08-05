import CryptoKit
import Foundation
import Testing

@testable import FrakSDK

/// The identity proof layout, asserted against the cross-platform corpus rather than
/// against itself: a port that only round-trips its own output proves nothing.
@Suite("ProofCodec")
struct ProofCodecTests {
    private static let merchantId = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
    private static let anonymousId = "256b1be3-2745-41d1-89d4-9121cc87bc45"

    private struct Fixture {
        let description: String
        let publicKey: Data
        let derivedClientId: String
        let op: ProofOp?
        let merchantId: String
        let anonymousId: String
        let binding: Data
        let ts: Int64
        let canonicalMessage: Data
        let signature: Data
        let proof: String
    }

    private static func fixtures() throws -> [Fixture] {
        let corpus = try GoldenFixtures.load(GoldenFixtures.identityProofs)
        return try corpus.entries.map { entry in
            guard let description = entry["description"] as? String,
                let publicKey = (entry["pubkeyUncompressedHex"] as? String).flatMap(Hex.decode),
                let derivedClientId = entry["derivedClientId"] as? String,
                let op = entry["op"] as? String,
                let merchantId = entry["merchantId"] as? String,
                let anonymousId = entry["anonymousId"] as? String,
                let binding = (entry["bindingHex"] as? String).flatMap(Hex.decode),
                let ts = entry["ts"] as? Int,
                let canonicalMessage = (entry["canonicalMsgHex"] as? String).flatMap(Hex.decode),
                let signature = (entry["sigHex"] as? String).flatMap(Hex.decode),
                let proof = entry["proof"] as? String
            else {
                throw GoldenFixtures.CorpusError(description: "malformed identity fixture: \(entry)")
            }
            return Fixture(
                description: description,
                publicKey: publicKey,
                derivedClientId: derivedClientId,
                // `frak-sso-v1` is a web-SDK op with no native caller: it has no case here.
                op: ProofOp(rawValue: op),
                merchantId: merchantId,
                anonymousId: anonymousId,
                binding: binding,
                ts: Int64(ts),
                canonicalMessage: canonicalMessage,
                signature: signature,
                proof: proof
            )
        }
    }

    @Test("derives every fixture's client id from its public key")
    func derivesEveryFixtureClientId() throws {
        let fixtures = try Self.fixtures()
        for fixture in fixtures {
            let derived = try ProofCodec.clientId(fromHash: Data(SHA256.hash(data: fixture.publicKey)))
            #expect(derived == fixture.derivedClientId, "\(fixture.description)")
        }
        #expect(!fixtures.isEmpty)
    }

    @Test("builds every fixture's canonical message byte for byte")
    func buildsEveryCanonicalMessage() throws {
        var covered: Set<ProofOp> = []
        for fixture in try Self.fixtures() {
            guard let op = fixture.op else { continue }
            covered.insert(op)
            let message = try ProofCodec.message(
                op: op,
                merchantId: fixture.merchantId,
                anonymousId: fixture.anonymousId,
                binding: fixture.binding,
                ts: fixture.ts
            )
            #expect(message == fixture.canonicalMessage, "\(fixture.description)")
        }
        // A new op with no fixture would otherwise ship unasserted.
        #expect(covered == [.ensure, .install, .merge])
    }

    @Test("encodes every fixture's proof envelope")
    func encodesEveryProofEnvelope() throws {
        let fixtures = try Self.fixtures()
        #expect(!fixtures.isEmpty)
        for fixture in fixtures {
            let proof = try ProofCodec.proof(
                publicKey: fixture.publicKey,
                ts: fixture.ts,
                signature: fixture.signature
            )
            #expect(proof == fixture.proof, "\(fixture.description)")
            #expect(proof.count == 184)
        }
    }

    @Test("fixture signatures verify against their canonical message")
    func fixtureSignaturesVerify() throws {
        let fixtures = try Self.fixtures()
        #expect(!fixtures.isEmpty)
        for fixture in fixtures {
            let key = try P256.Signing.PublicKey(x963Representation: fixture.publicKey)
            let signature = try P256.Signing.ECDSASignature(rawRepresentation: fixture.signature)
            #expect(key.isValidSignature(signature, for: fixture.canonicalMessage), "\(fixture.description)")
        }
    }

    @Test("signs and verifies with a freshly generated key")
    func signsAndVerifiesWithAFreshKey() throws {
        let key = DeviceKey.software(P256.Signing.PrivateKey())
        let message = try ProofCodec.message(
            op: .ensure,
            merchantId: Self.merchantId,
            anonymousId: Self.anonymousId,
            binding: Data(),
            ts: 1_700_000_000
        )
        let signature = try key.sign(message)
        #expect(signature.count == 64)

        let publicKey = try P256.Signing.PublicKey(x963Representation: key.publicKeyUncompressed)
        let parsed = try P256.Signing.ECDSASignature(rawRepresentation: signature)
        #expect(publicKey.isValidSignature(parsed, for: message))
    }

    @Test("signs the same bytes whatever case the uuid arrived in")
    func normalisesUUIDCase() throws {
        let lower = try ProofCodec.message(
            op: .ensure,
            merchantId: Self.merchantId,
            anonymousId: Self.anonymousId,
            binding: Data(),
            ts: 1
        )
        let upper = try ProofCodec.message(
            op: .ensure,
            merchantId: Self.merchantId.uppercased(),
            anonymousId: Self.anonymousId,
            binding: Data(),
            ts: 1
        )
        #expect(lower == upper)
    }

    @Test("emits the derived id in lowercase")
    func derivedIdIsLowercase() throws {
        let derived = try ProofCodec.clientId(fromHash: Data(repeating: 0xAB, count: 32))
        #expect(derived == derived.lowercased())
        #expect(derived.count == 36)
    }

    @Test("rejects a binding that is neither empty nor 32 bytes")
    func rejectsAWrongWidthBinding() {
        #expect(throws: InvalidProofInput.self) {
            try ProofCodec.message(
                op: .merge,
                merchantId: Self.merchantId,
                anonymousId: Self.anonymousId,
                binding: Data(repeating: 0, count: 31),
                ts: 1
            )
        }
    }

    @Test("rejects a malformed uuid")
    func rejectsAMalformedUUID() {
        #expect(throws: InvalidProofInput.self) {
            try ProofCodec.message(
                op: .ensure,
                merchantId: "not-a-uuid",
                anonymousId: Self.anonymousId,
                binding: Data(),
                ts: 1
            )
        }
    }

    @Test("rejects a public key or signature of the wrong width")
    func rejectsWrongWidthKeyMaterial() {
        #expect(throws: InvalidProofInput.self) {
            try ProofCodec.proof(publicKey: Data(count: 64), ts: 1, signature: Data(count: 64))
        }
        #expect(throws: InvalidProofInput.self) {
            try ProofCodec.proof(publicKey: Data(count: 65), ts: 1, signature: Data(count: 63))
        }
    }

    @Test("rejects a negative timestamp")
    func rejectsANegativeTimestamp() {
        #expect(throws: InvalidProofInput.self) {
            try ProofCodec.message(
                op: .ensure,
                merchantId: Self.merchantId,
                anonymousId: Self.anonymousId,
                binding: Data(),
                ts: -1
            )
        }
    }
}
