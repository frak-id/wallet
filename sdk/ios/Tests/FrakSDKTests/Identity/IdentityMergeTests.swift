import CryptoKit
import Foundation
import Testing

@testable import FrakSDK

/// Proofs are verified, not just asserted non-nil: a wrong binding fails only in production.
@Suite("IdentityMerge")
struct IdentityMergeTests {
    private static let merchantId = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
    private static let anonymousId = "256b1be3-2745-41d1-89d4-9121cc87bc45"

    private static let token = "eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2VHcm91cElkIjoiYWJjIn0.c2lnbmF0dXJl"

    private struct Harness {
        let merge: IdentityMerge
        let identity: AnonymousIdStore
        let requests: RequestLog
        let host: String
    }

    private func makeHarness(
        status: Int = 200,
        body: String = "{}",
        trackingEnabled: Bool = true
    ) -> Harness {
        let (session, host) = StubURLProtocol.makeSession()
        let requests = RequestLog()
        StubURLProtocol.handle(host: host) { request in
            requests.record(request)
            return StubResponse(status: status, body: body)
        }
        let logger = FrakLogger(level: .none)
        let values = InMemoryKeyValueStore()
        let identity = AnonymousIdStore(
            keyStore: FakeDeviceKeyStore(),
            store: values,
            logger: logger,
            merchantMarker: Self.merchantId,
            consent: TrackingConsent(store: values, configDefault: trackingEnabled, logger: logger)
        )
        let http = HTTPClient(baseURL: "https://\(host)", session: session, logger: logger)
        return Harness(
            merge: IdentityMerge(http: http, identity: identity, logger: logger),
            identity: identity,
            requests: requests,
            host: host
        )
    }

    @Test("posts the merge to the execute route with the target id")
    func postsTheMerge() async throws {
        let harness = makeHarness(body: #"{"finalGroupId":"\#(Self.merchantId)","merged":true}"#)
        defer { StubURLProtocol.reset(host: harness.host) }
        let anonymousId = try #require(await harness.identity.anonymousId())

        let merged = await harness.merge.execute(
            mergeToken: Self.token,
            merchantId: Self.merchantId,
            anonymousId: anonymousId
        )

        #expect(merged)
        let request = try #require(harness.requests.all.first)
        #expect(harness.requests.count == 1)
        #expect(request.httpMethod == "POST")
        #expect(request.url?.path == IdentityMerge.executePath)
        let body = request.stubJSON
        #expect(body["mergeToken"] as? String == Self.token)
        #expect(body["targetAnonymousId"] as? String == anonymousId)
        #expect(body["merchantId"] as? String == Self.merchantId)
    }

    @Test("signs the proof over the merge token binding")
    func signsOverTheTokenBinding() async throws {
        let harness = makeHarness()
        defer { StubURLProtocol.reset(host: harness.host) }
        let anonymousId = try #require(await harness.identity.anonymousId())
        await harness.merge.execute(
            mergeToken: Self.token,
            merchantId: Self.merchantId,
            anonymousId: anonymousId
        )

        let proof = try #require(harness.requests.all.first?.stubJSON["proof"] as? String)
        let envelope = try #require(Base64URL.decode(proof))
        #expect(envelope.count == 138)

        let expected = try ProofCodec.message(
            op: .merge,
            merchantId: Self.merchantId,
            anonymousId: anonymousId,
            binding: Data(SHA256.hash(data: Data(Self.token.utf8))),
            ts: Self.timestamp(in: envelope)
        )

        let key = try P256.Signing.PublicKey(x963Representation: envelope[1..<66])
        let signature = try P256.Signing.ECDSASignature(rawRepresentation: envelope[74..<138])
        #expect(key.isValidSignature(signature, for: expected))
    }

    @Test("acts on a given token only once")
    func actsOnATokenOnce() async throws {
        let harness = makeHarness()
        defer { StubURLProtocol.reset(host: harness.host) }
        let anonymousId = try #require(await harness.identity.anonymousId())

        let first = await harness.merge.execute(
            mergeToken: Self.token,
            merchantId: Self.merchantId,
            anonymousId: anonymousId
        )
        let second = await harness.merge.execute(
            mergeToken: Self.token,
            merchantId: Self.merchantId,
            anonymousId: anonymousId
        )

        #expect(first)
        #expect(!second)
        #expect(harness.requests.count == 1)
    }

    @Test("sends nothing when tracking is disabled")
    func sendsNothingWithoutConsent() async {
        let harness = makeHarness(trackingEnabled: false)
        defer { StubURLProtocol.reset(host: harness.host) }

        let merged = await harness.merge.execute(
            mergeToken: Self.token,
            merchantId: Self.merchantId,
            anonymousId: Self.anonymousId
        )

        #expect(!merged)
        #expect(harness.requests.count == 0)
    }

    /// A non-uuid merchant is the one input `signProof` refuses for an otherwise live identity.
    @Test("sends nothing when the identity exists but no proof can be produced")
    func sendsNothingWithoutAProof() async throws {
        let harness = makeHarness()
        defer { StubURLProtocol.reset(host: harness.host) }
        #expect(try #require(await harness.identity.anonymousId()).count == 36)

        let merged = await harness.merge.execute(
            mergeToken: Self.token,
            merchantId: "not-a-uuid",
            anonymousId: Self.anonymousId
        )

        #expect(!merged)
        #expect(harness.requests.count == 0)
    }

    @Test("reports a refusal without throwing")
    func reportsARefusal() async throws {
        let harness = makeHarness(status: 403, body: #"{"code":"PROOF_INVALID"}"#)
        defer { StubURLProtocol.reset(host: harness.host) }
        let anonymousId = try #require(await harness.identity.anonymousId())

        let merged = await harness.merge.execute(
            mergeToken: Self.token,
            merchantId: Self.merchantId,
            anonymousId: anonymousId
        )

        #expect(!merged)
    }

    @Test("reads the token out of an inbound url and ignores links without one")
    func parsesTheToken() {
        #expect(IdentityMerge.parseToken("https://shop.example/p?fmt=\(Self.token)") == Self.token)
        #expect(
            IdentityMerge.parseToken("https://shop.example/p?fCtx=abc&fmt=\(Self.token)&utm_source=frak")
                == Self.token
        )
        #expect(IdentityMerge.parseToken("https://shop.example/p?fCtx=abc") == nil)
        #expect(IdentityMerge.parseToken("https://shop.example/p?fmt=") == nil)
        #expect(IdentityMerge.parseToken("not-a-url") == nil)
    }

    /// Bytes 66..<74 of the envelope: `v(1) + pk(65) + ts(8) + sig(64)`.
    private static func timestamp(in envelope: Data) -> Int64 {
        envelope[66..<74].reduce(Int64(0)) { ($0 << 8) | Int64($1) }
    }
}
