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
    /// Read fresh on every drain, so an identity reset takes effect mid-flight. Async (4.5):
    /// `AnonymousIdStore.anonymousId()` awaits eager generation rather than blocking, so this
    /// drain loop no longer calls a blocking keystore read from inside itself.
    private let currentClientId: @Sendable () async -> String?
    /// S6a/C7: whether tracking is still permitted, read fresh inside the drain loop.
    ///
    /// A `purge()` alone cannot stop a drain: `drain()` reads the whole backlog, then posts it one
    /// event at a time with `await`s in between, so an event already in `pending` would still be
    /// uploaded after the user withdrew consent — and the stale-id guard below cannot catch it,
    /// because withdrawing consent makes `currentClientId` nil, which disables that guard rather
    /// than tightening it. Re-reading this per event is what actually stops the upload.
    ///
    /// Defaults to always-allowed so the tracker's own tests, which have no consent store, are
    /// unaffected; the real gate is wired in `DefaultFrakClient`.
    private let trackingAllowed: @Sendable () async -> Bool
    private let now: @Sendable () -> Date
    private let newKey: @Sendable () -> String

    private var backoff: Backoff
    private var drainTask: Task<Void, Never>?
    /// Set when the queue changes under a running drain, so it loops once more.
    private var drainAgain = false
    /// Bumped every time `drainTask` is replaced or cleared, so a finishing drain can tell whether
    /// the slot still holds it before nilling it out. See `scheduleDrain` for what goes wrong
    /// without it.
    private var drainToken = 0
    /// Set once by `shutdown()`, never cleared: a torn-down tracker starts no further drains.
    private var stopped = false

    init(
        queue: EventQueue,
        http: HTTPClient,
        logger: FrakLogger,
        currentClientId: @escaping @Sendable () async -> String?,
        trackingAllowed: @escaping @Sendable () async -> Bool = { true },
        now: @escaping @Sendable () -> Date = { Date() },
        newKey: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() },
        backoff: Backoff = Backoff()
    ) {
        self.queue = queue
        self.http = http
        self.logger = logger
        self.currentClientId = currentClientId
        self.trackingAllowed = trackingAllowed
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

    /// S6b/C7. Cancels an in-flight drain and refuses to start another, so
    /// `DefaultFrakClient.shutdown()` leaves nothing running and nothing able to start.
    ///
    /// The refusal is the load-bearing half. Cancelling alone would not do it: `scheduleDrain`
    /// uses `Task.init`, which does **not** inherit cancellation, so the very next `track()` would
    /// start a fresh, uncancelled drain and "shut down" would have meant "paused until the next
    /// event". Android gets this for free — every drain is a child of the one scope
    /// `DefaultFrakClient.shutdown()` cancels — and this flag is how the same guarantee is bought
    /// here. It is one-way: a torn-down tracker is not restartable, matching `Frak.shutdown()`'s
    /// contract that you get a live SDK by calling `Frak.initialize` again, which builds a new one.
    ///
    /// Does NOT await the cancelled task: `drain()` writes the queue file back after each batch,
    /// and awaiting a task we have just cancelled would block shutdown on a network round-trip
    /// that is already doomed. Queued events survive on disk — shutdown is not erasure, `purge()`
    /// is. The token is bumped too, so the drain being cancelled cannot clear a `drainTask` that a
    /// `track()` racing this call installed while it was still unwinding.
    func shutdown() {
        stopped = true
        drainToken += 1
        drainTask?.cancel()
        drainTask = nil
        drainAgain = false
    }

    /// Returns the drain covering everything enqueued so far. A drain already under way is
    /// reused rather than followed by a second full pass: it re-reads the file, so noting that
    /// the queue changed is enough. Awaiting the returned task therefore awaits a pass that
    /// includes the caller's own event.
    private func scheduleDrain() -> Task<Void, Never> {
        // Returns an already-finished task rather than nil, so `flush()`'s `await …value` still
        // has something to await and every caller keeps one shape. See `shutdown()`.
        guard !stopped else { return Task {} }
        if let inFlight = drainTask {
            drainAgain = true
            return inFlight
        }
        // Same shape, and the same reason, as `AnonymousIdStore.generationToken` (S6b/C7): the tail
        // below has to know whether the `drainTask` slot still holds THIS task before clearing it.
        // It cannot compare against `task` itself — a closure may not capture the `let` it is being
        // assigned to. A token bumped on every install and by `shutdown()` answers the same
        // question with an immutable capture.
        //
        // Without it: `shutdown()` clears `drainTask` while this task is still unwinding, a
        // `track()` immediately after installs a new one, this tail then erases that newer task,
        // and the next `track()` starts a SECOND concurrent drain over the same queue file — two
        // writers, which `EventQueue` explicitly does not serialise (02 §5.3).
        drainToken += 1
        let token = drainToken
        let task = Task {
            repeat {
                self.drainAgain = false
                await self.drain()
            } while self.drainAgain && !Task.isCancelled
            if self.drainToken == token { self.drainTask = nil }
        }
        drainTask = task
        return task
    }

    private func drain() async {
        // S6a/C7: before the read, so a drain started by a `track()` that raced a consent
        // withdrawal never even loads the backlog. The per-event re-read below is what closes the
        // withdrawal-lands-mid-drain window; this one just avoids the pointless work.
        guard await trackingAllowed() else { return }
        guard !backoff.isBackingOff(Self.backoffKey) else { return }

        let pending = await queue.read(now: now())
        guard !pending.isEmpty else {
            // Nothing to send, but expired rows may still be on disk. `reconcile` rather than
            // `replace([])`: read and write must be one hop, or a `track` appending between them
            // is read by neither and erased by the second.
            await queue.reconcile(delivered: [], retried: [:], now: now())
            return
        }

        let currentId = await currentClientId()
        var delivered: Set<Int64> = []
        var retried: [Int64: QueuedEvent] = [:]

        for event in pending {
            // S6a/C7. `break`, not `return`: the caller that flipped consent is about to `purge()`
            // the whole file, so it is tempting to leave the file alone — but if that purge does not
            // land, every event this drain ALREADY uploaded is still on disk with no record that it
            // went, and the next flush re-sends all of them. An `Interaction.arrival` carries no
            // idempotency key: that is a duplicated referral payout. Falling through to `reconcile`
            // costs nothing when the purge does work (it re-reads the file, so a purge that already
            // ran wins) and prevents that when it does not. Unlike the cancellation path further
            // down, which must `return` — there the queue file must be left exactly as found.
            guard await trackingAllowed() else {
                logger.info("Tracking was disabled mid-drain; stopping without sending the rest.")
                break
            }

            // Every event `queue.read` returns has already been migrated to a non-nil `rowId`;
            // this guard exists so a future caller of `drain()` with a hand-built list can't
            // silently reconcile the wrong row instead of crashing loudly in debug.
            guard let rowId = event.rowId else {
                assertionFailure("a queued event reaching drain() must already have a rowId")
                continue
            }

            // Captured under an id that has since been replaced. Dropped, not sent: it would
            // re-link an identity the user already walked away from.
            if let captured = event.clientId, let currentId, captured != currentId {
                delivered.insert(rowId)
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
                delivered.insert(rowId)
                continue
            }

            backoff.recordFailure(Self.backoffKey, from: response.toServerError())
            // Transient: the event is fine, the backend is not. Keep it as it is.
            if response.status == Self.tooManyRequests || response.status >= Self.serverError { break }

            let failed = event.withFailure()
            if failed.failures >= Self.maxFailures {
                logger.warn("Dropping an event the backend keeps rejecting (HTTP \(response.status)).")
                delivered.insert(rowId)
            } else {
                retried[rowId] = failed
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
