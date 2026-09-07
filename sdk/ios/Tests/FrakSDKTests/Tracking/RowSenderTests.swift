import Foundation
import Testing

@testable import FrakSDK

@Suite("RowSender")
struct RowSenderTests {
    private static let merchantId = "550e8400-e29b-41d4-a716-446655440000"
    private static let clientId = "256b1be3-2745-41d1-89d4-9121cc87bc45"

    private func row(
        kind: String,
        payload: String,
        merchantId: String? = merchantId,
        idempotencyKey: String = "k"
    ) -> QueuedRow {
        QueuedRow(
            idempotencyKey: idempotencyKey,
            kind: kind,
            payload: payload,
            clientId: Self.clientId,
            merchantId: merchantId,
            capturedAt: Date(timeIntervalSince1970: 0)
        )
    }

    private func context(
        status: Int = 200,
        body: String = "{}",
        signProof: String? = "proof"
    ) -> (
        ctx: SendContext, requests: RequestLog, host: String
    ) {
        let (session, host) = StubURLProtocol.makeSession()
        let requests = RequestLog()
        StubURLProtocol.handle(host: host) { request in
            requests.record(request)
            return StubResponse(status: status, body: body)
        }
        let ctx = SendContext(
            http: HTTPClient(baseURL: "https://\(host)", session: session),
            resolveMerchantId: { Self.merchantId },
            signProof: { _, _, _ in signProof }
        )
        return (ctx, requests, host)
    }

    // MARK: - classify (one shared table for every sender)

    @Test("classify: 2xx is delivered")
    func classify2xx() {
        #expect(isDelivered(PurchaseSender().classify(response(200))))
        #expect(isDelivered(PurchaseSender().classify(response(299))))
    }

    @Test("classify: 429 and 5xx are retryable")
    func classifyRetryable() {
        #expect(isRetryable(PurchaseSender().classify(response(429))))
        #expect(isRetryable(PurchaseSender().classify(response(500))))
        #expect(isRetryable(PurchaseSender().classify(response(503))))
    }

    @Test("classify: any other non-2xx is rejected")
    func classifyRejected() {
        #expect(isRejected(PurchaseSender().classify(response(400))))
        #expect(isRejected(PurchaseSender().classify(response(404))))
        #expect(isRejected(PurchaseSender().classify(response(422))))
    }

    // MARK: - hold budgets

    @Test("default hold timeout is 24 hours")
    func defaultHoldTimeout() {
        #expect(PurchaseSender().holdTimeout == 24 * 60 * 60)
        #expect(InteractionSender(logger: FrakLogger(level: .none)).holdTimeout == 24 * 60 * 60)
    }

    @Test("merge's hold budget is 1 hour, not the 24h default")
    func mergeHoldTimeout() {
        #expect(MergeSender(logger: FrakLogger(level: .none)).holdTimeout == 60 * 60)
    }

    // MARK: - registry

    @Test("the default registry maps each kind to the sender that owns it")
    func defaultRegistry() {
        let registry = RowSenders.default(logger: FrakLogger(level: .none))
        #expect(registry[InteractionSender.kind] is InteractionSender)
        #expect(registry[PurchaseSender.kind] is PurchaseSender)
        #expect(registry[MergeSender.kind] is MergeSender)
        #expect(registry.count == 3)
    }

    // MARK: - PurchaseSender (mechanical)

    @Test("PurchaseSender injects merchantId and posts to the purchase route")
    func purchaseSenderDelivers() async throws {
        let (ctx, requests, host) = context()
        defer { StubURLProtocol.reset(host: host) }
        let outcome = try await PurchaseSender().deliver(
            row: row(kind: PurchaseSender.kind, payload: #"{"orderId":"o1"}"#, merchantId: nil),
            ctx: ctx
        )
        #expect(isDelivered(outcome))
        let request = try #require(requests.all.first)
        #expect(request.url?.path == "/user/track/purchase")
        #expect(request.stubJSON["merchantId"] as? String == Self.merchantId)
    }

    @Test("PurchaseSender holds when no merchant is known and none resolves")
    func purchaseSenderHoldsWithoutMerchant() async throws {
        let (session, host) = StubURLProtocol.makeSession()
        defer { StubURLProtocol.reset(host: host) }
        StubURLProtocol.handle(host: host) { _ in StubResponse(status: 200, body: "{}") }
        let ctx = SendContext(
            http: HTTPClient(baseURL: "https://\(host)", session: session),
            resolveMerchantId: { nil },
            signProof: { _, _, _ in nil }
        )
        let outcome = try await PurchaseSender().deliver(
            row: row(kind: PurchaseSender.kind, payload: "{}", merchantId: nil),
            ctx: ctx
        )
        #expect(isHold(outcome))
    }

    // MARK: - InteractionSender (foreign-merchant arrival guard)

    @Test("InteractionSender drops an arrival captured for another merchant")
    func interactionSenderDropsForeignArrival() async throws {
        let (ctx, requests, host) = context()
        defer { StubURLProtocol.reset(host: host) }
        let payload = #"{"type":"arrival","referrerMerchantId":"other-merchant"}"#
        let outcome = try await InteractionSender(logger: FrakLogger(level: .none)).deliver(
            row: row(kind: InteractionSender.kind, payload: payload),
            ctx: ctx
        )
        #expect(isDropped(outcome))
        #expect(requests.count == 0)
    }

    @Test("InteractionSender delivers a same-merchant arrival")
    func interactionSenderDeliversOwnArrival() async throws {
        let (ctx, requests, host) = context()
        defer { StubURLProtocol.reset(host: host) }
        let payload = #"{"type":"arrival","referrerMerchantId":"\#(Self.merchantId)"}"#
        let outcome = try await InteractionSender(logger: FrakLogger(level: .none)).deliver(
            row: row(kind: InteractionSender.kind, payload: payload),
            ctx: ctx
        )
        #expect(isDelivered(outcome))
        #expect(requests.count == 1)
    }

    // MARK: - MergeSender

    @Test("MergeSender holds rather than rejects when the proof cannot be minted")
    func mergeSenderHoldsOnNilProof() async throws {
        let (ctx, requests, host) = context(signProof: nil)
        defer { StubURLProtocol.reset(host: host) }
        let outcome = try await MergeSender(logger: FrakLogger(level: .none)).deliver(
            row: row(kind: MergeSender.kind, payload: "{}", merchantId: nil, idempotencyKey: "merge-token"),
            ctx: ctx
        )
        #expect(isHold(outcome))
        #expect(requests.count == 0)
    }

    @Test("MergeSender drops a row with no anonymous id")
    func mergeSenderDropsWithoutAnonymousId() async throws {
        let (ctx, requests, host) = context()
        defer { StubURLProtocol.reset(host: host) }
        let noClientId = QueuedRow(
            idempotencyKey: "merge-token",
            kind: MergeSender.kind,
            payload: "{}",
            clientId: nil,
            merchantId: nil,
            capturedAt: Date(timeIntervalSince1970: 0)
        )
        let outcome = try await MergeSender(logger: FrakLogger(level: .none)).deliver(row: noClientId, ctx: ctx)
        #expect(isDropped(outcome))
        #expect(requests.count == 0)
    }

    @Test("MergeSender mints a fresh proof on every attempt")
    func mergeSenderMintsProofEveryAttempt() async throws {
        let (ctx, requests, host) = context()
        defer { StubURLProtocol.reset(host: host) }
        let mergeRow = row(kind: MergeSender.kind, payload: "{}", merchantId: nil, idempotencyKey: "merge-token")
        _ = try await MergeSender(logger: FrakLogger(level: .none)).deliver(row: mergeRow, ctx: ctx)
        _ = try await MergeSender(logger: FrakLogger(level: .none)).deliver(row: mergeRow, ctx: ctx)
        #expect(requests.count == 2)
        for request in requests.all {
            #expect(request.stubJSON["proof"] as? String == "proof")
        }
    }

    // MARK: - helpers

    private func response(_ status: Int) -> HTTPClient.Response {
        HTTPClient.Response(status: status, body: Data(), retryAfterSeconds: nil)
    }

    private func isDelivered(_ outcome: DeliveryOutcome) -> Bool {
        if case .delivered = outcome { return true }
        return false
    }

    private func isRetryable(_ outcome: DeliveryOutcome) -> Bool {
        if case .retryable = outcome { return true }
        return false
    }

    private func isRejected(_ outcome: DeliveryOutcome) -> Bool {
        if case .rejected = outcome { return true }
        return false
    }

    private func isHold(_ outcome: DeliveryOutcome) -> Bool {
        if case .hold = outcome { return true }
        return false
    }

    private func isDropped(_ outcome: DeliveryOutcome) -> Bool {
        if case .dropped = outcome { return true }
        return false
    }
}
