import Foundation

/// Captures interactions durably, then drains them oldest-first.
///
/// The queue is the contract: `track` returns once the event is on disk, not once it is
/// delivered. Delivery is a best-effort drain that stops at the first failure, so a later
/// event is never sent before an earlier one has gone through.
actor InteractionTracker {
    private static let interactionPath = "/user/track/interaction"
    private static let purchasePath = "/user/track/purchase"
    private static let clientIdHeader = "x-frak-client-id"
    private static let tooManyRequests = 429
    private static let serverError = 500
    /// Permanent rejections tolerated before an event is dropped rather than left blocking
    /// the head of the queue forever.
    private static let maxFailures = 3
    private static let backoffKey = "track"

    private let queue: EventQueue
    private let http: HTTPClient
    private let logger: FrakLogger
    /// Read fresh on every drain, so an identity reset takes effect mid-flight.
    private let currentClientId: @Sendable () -> String?
    private let now: @Sendable () -> Date
    private let newKey: @Sendable () -> String

    private var backoff: Backoff
    private var drainTask: Task<Void, Never>?
    /// Set when the queue changes under a running drain, so it loops once more.
    private var drainAgain = false

    init(
        queue: EventQueue,
        http: HTTPClient,
        logger: FrakLogger,
        currentClientId: @escaping @Sendable () -> String?,
        now: @escaping @Sendable () -> Date = { Date() },
        newKey: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() },
        backoff: Backoff = Backoff()
    ) {
        self.queue = queue
        self.http = http
        self.logger = logger
        self.currentClientId = currentClientId
        self.now = now
        self.newKey = newKey
        self.backoff = backoff
    }

    func track(merchantId: String, clientId: String?, interaction: Interaction) async {
        let key = idempotencyKey(for: interaction)
        let body = interactionBody(merchantId: merchantId, interaction: interaction, idempotencyKey: key)
        await enqueue(path: Self.interactionPath, body: body, clientId: clientId, idempotencyKey: key)
        detachDrain()
    }

    func trackPurchase(
        merchantId: String,
        clientId: String?,
        customerId: String,
        orderId: String,
        token: String
    ) async {
        // No idempotency key: the purchase route carries no such field and reconciles on
        // `(orderId, token)` server-side.
        let body = Self.json([
            "merchantId": merchantId,
            "customerId": customerId,
            "orderId": orderId,
            "token": token,
        ])
        await enqueue(path: Self.purchasePath, body: body, clientId: clientId, idempotencyKey: newKey())
        detachDrain()
    }

    /// Starts a drain without waiting for it: `track` is durable once enqueued, and a caller
    /// on a button handler must not block on a whole backlog.
    private func detachDrain() {
        _ = scheduleDrain()
    }

    /// Drops every queued event. An event captured under an id the user asked to be
    /// forgotten must never be emitted.
    func purge() async {
        await queue.clear()
    }

    /// Drains the queue. Awaiting this awaits the drain, including one already under way.
    func flush() async {
        await scheduleDrain().value
    }

    /// Returns the drain covering everything enqueued so far. A drain already under way is
    /// reused rather than followed by a second full pass: it re-reads the file, so noting that
    /// the queue changed is enough. Awaiting the returned task therefore awaits a pass that
    /// includes the caller's own event.
    private func scheduleDrain() -> Task<Void, Never> {
        if let inFlight = drainTask {
            drainAgain = true
            return inFlight
        }
        let task = Task {
            repeat {
                self.drainAgain = false
                await self.drain()
            } while self.drainAgain
            self.drainTask = nil
        }
        drainTask = task
        return task
    }

    private func drain() async {
        guard !backoff.isBackingOff(Self.backoffKey) else { return }

        let pending = await queue.read(now: now())
        guard !pending.isEmpty else {
            // Nothing to send, but expired rows may still be on disk. `reconcile` rather than
            // `replace([])`: read and write must be one hop, or a `track` appending between them
            // is read by neither and erased by the second.
            await queue.reconcile(delivered: [], retried: [:], now: now())
            return
        }

        let currentId = currentClientId()
        var delivered: Set<String> = []
        var retried: [String: QueuedEvent] = [:]

        for event in pending {
            // Captured under an id that has since been replaced. Dropped, not sent: it would
            // re-link an identity the user already walked away from.
            if let captured = event.clientId, let currentId, captured != currentId {
                delivered.insert(event.idempotencyKey)
                continue
            }

            let response: HTTPClient.Response
            do {
                response = try await http.post(
                    event.path,
                    body: Data(event.body.utf8),
                    headers: headers(for: event)
                )
            } catch let error as FrakError {
                backoff.recordFailure(Self.backoffKey, from: error)
                break
            } catch {
                // Cancellation, and nothing else — `HTTPClient` maps every transport failure to
                // a `FrakError`. Returning rather than breaking skips the reconcile below, so a
                // cancelled drain leaves the file exactly as it found it: re-sending a delivered
                // event is recoverable server-side, compacting away an undelivered one is not.
                return
            }

            if response.isSuccess {
                backoff.recordSuccess(Self.backoffKey)
                delivered.insert(event.idempotencyKey)
                continue
            }

            backoff.recordFailure(Self.backoffKey, from: response.toServerError())
            // Transient: the event is fine, the backend is not. Keep it as it is.
            if response.status == Self.tooManyRequests || response.status >= Self.serverError { break }

            let failed = event.withFailure()
            if failed.failures >= Self.maxFailures {
                logger.warn("Dropping an event the backend keeps rejecting (HTTP \(response.status)).")
                delivered.insert(event.idempotencyKey)
            } else {
                retried[event.idempotencyKey] = failed
            }
            break
        }

        // Re-read rather than write back `pending`: a `track` that landed while the drain was
        // awaiting the network is in the file now, and must not be compacted away.
        await queue.reconcile(delivered: delivered, retried: retried, now: now())
    }

    private func enqueue(path: String, body: String, clientId: String?, idempotencyKey: String) async {
        await queue.append(
            QueuedEvent(
                idempotencyKey: idempotencyKey,
                path: path,
                body: body,
                clientId: clientId,
                capturedAt: now()
            )
        )
    }

    private func headers(for event: QueuedEvent) -> [String: String] {
        event.clientId.map { [Self.clientIdHeader: $0] } ?? [:]
    }

    private func idempotencyKey(for interaction: Interaction) -> String {
        if case .custom(_, _, let supplied) = interaction.kind, let supplied {
            return supplied
        }
        return newKey()
    }

    private func interactionBody(merchantId: String, interaction: Interaction, idempotencyKey: String) -> String {
        switch interaction.kind {
        case .arrival(let wallet, let clientId, let referrerMerchantId, let timestamp):
            return Self.json([
                "merchantId": merchantId,
                "type": "arrival",
                "referrerWallet": wallet,
                "referrerClientId": clientId,
                "referrerMerchantId": referrerMerchantId,
                "referralTimestamp": timestamp,
            ])
        case .sharing(let timestamp, let purchaseId):
            return Self.json([
                "merchantId": merchantId,
                "type": "sharing",
                // Unix seconds, stamped now and stored: a retry must not restamp it.
                "sharingTimestamp": timestamp ?? Int64(now().timeIntervalSince1970),
                "purchaseId": purchaseId,
                "idempotencyKey": idempotencyKey,
            ])
        case .custom(let customType, let data, _):
            return Self.json([
                "merchantId": merchantId,
                "type": "custom",
                "customType": customType,
                "data": data,
                "idempotencyKey": idempotencyKey,
            ])
        }
    }

    /// Sorted keys so a body is byte-identical every time it is built — the queue stores it
    /// verbatim, and a test that reads it back should not depend on dictionary order.
    /// Nil-valued keys are absent rather than JSON null, matching the Kotlin twin.
    ///
    /// Every value here is a `String`, `Int64` or `[String: String]`, so the fallback is
    /// unreachable. It is a fallback rather than a trap because an SDK does not get to bring
    /// down its host over a body it failed to build.
    private static func json(_ fields: [String: Any?]) -> String {
        let object = fields.compactMapValues { $0 }
        guard let data = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
            let text = String(data: data, encoding: .utf8)
        else {
            return "{}"
        }
        return text
    }
}
