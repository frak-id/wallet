import CryptoKit
import Foundation
import Testing

@testable import FrakSDK

/// Proofs are verified, not just asserted non-nil: a wrong binding fails only in production.
/// Moved here from `IdentityMergeTests` when `IdentityMerge.execute()` was deleted — this is
/// the only executed coverage of the merge wire body against a real, enclave-signed proof.
@Suite("MergeSender wire body")
struct MergeSenderWireTests {
    private static let merchantId = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"
    private static let token = "eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2VHcm91cElkIjoiYWJjIn0.c2lnbmF0dXJl"

    private struct Harness {
        let sender: MergeSender
        let ctx: SendContext
        let identity: AnonymousIdStore
        let requests: RequestLog
        let host: String
    }

    private func makeHarness(status: Int = 200, body: String = "{}") -> Harness {
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
            consent: TrackingConsent(store: values, configDefault: true, logger: logger)
        )
        let http = HTTPClient(baseURL: "https://\(host)", session: session, logger: logger)
        let ctx = SendContext(
            http: http,
            resolveMerchantId: { Self.merchantId },
            signProof: { op, merchantId, binding in
                await identity.signProof(op, merchantId: merchantId, binding: binding)
            }
        )
        return Harness(
            sender: MergeSender(logger: logger),
            ctx: ctx,
            identity: identity,
            requests: requests,
            host: host
        )
    }

    private func row(anonymousId: String) -> QueuedRow {
        QueuedRow(
            idempotencyKey: Self.token,
            kind: MergeSender.kind,
            payload: "{}",
            clientId: anonymousId,
            merchantId: Self.merchantId,
            capturedAt: Date(timeIntervalSince1970: 0)
        )
    }

    @Test("posts the merge to the execute route with the target id")
    func postsTheMerge() async throws {
        let harness = makeHarness(body: #"{"finalGroupId":"\#(Self.merchantId)","merged":true}"#)
        defer { StubURLProtocol.reset(host: harness.host) }
        let anonymousId = try #require(await harness.identity.anonymousId())

        let outcome = try await harness.sender.deliver(row: row(anonymousId: anonymousId), ctx: harness.ctx)

        guard case .delivered = outcome else {
            Issue.record("expected delivered, got \(outcome)")
            return
        }
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

        _ = try await harness.sender.deliver(row: row(anonymousId: anonymousId), ctx: harness.ctx)

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

    @Test("reports a backend refusal as rejected, not thrown")
    func reportsARefusal() async throws {
        let harness = makeHarness(status: 403, body: #"{"code":"PROOF_INVALID"}"#)
        defer { StubURLProtocol.reset(host: harness.host) }
        let anonymousId = try #require(await harness.identity.anonymousId())

        let outcome = try await harness.sender.deliver(row: row(anonymousId: anonymousId), ctx: harness.ctx)

        guard case .rejected = outcome else {
            Issue.record("expected rejected, got \(outcome)")
            return
        }
    }

    /// Bytes 66..<74 of the envelope: `v(1) + pk(65) + ts(8) + sig(64)`.
    private static func timestamp(in envelope: Data) -> Int64 {
        envelope[66..<74].reduce(Int64(0)) { ($0 << 8) | Int64($1) }
    }
}
