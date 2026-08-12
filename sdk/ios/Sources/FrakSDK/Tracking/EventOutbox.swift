import Foundation

/// Captures interactions, purchases and identity merges durably, then drains them oldest-first
/// through the `RowSender` registered for each row's `kind`.
///
/// The queue is the contract: `track` returns once the event is on disk, not once it is
/// delivered. Delivery is a best-effort drain that stops at the first failure, so a later
/// event is never sent before an earlier one has gone through.
actor EventOutbox {
    private static let interactionKind = InteractionSender.kind
    private static let purchaseKind = PurchaseSender.kind
    private static let mergeKind = MergeSender.kind
    /// Permanent rejections tolerated before a row is dropped rather than left blocking
    /// the head of the queue forever.
    private static let maxFailures = 3
    private static let backoffKey = "track"

    private let queue: EventQueue
    private let http: HTTPClient
    private let logger: FrakLogger
    /// The only place a `QueuedRow.kind` is turned into a request. An unregistered kind is
    /// `continue`d in `drain()`, not dropped — see `QueuedRow.currentSchemaVersion`.
    private let senders: [String: any RowSender]
    /// Read fresh on every drain, so an identity reset takes effect mid-flight. Async:
    /// `AnonymousIdStore.anonymousId()` awaits eager generation rather than blocking, so this
    /// drain loop does not call a blocking keystore read from inside itself.
    private let currentClientId: @Sendable () async -> String?
    /// Read fresh inside the drain loop, so a withdrawal mid-drain stops the upload. `purge()`
    /// alone cannot: `drain()` reads the backlog up front, and the stale-id guard below is
    /// disabled rather than tightened by the nil id a withdrawal produces.
    ///
    /// Defaults to always-allowed for this file's own tests; the real gate is wired in
    /// `DefaultFrakClient`.
    private let trackingAllowed: @Sendable () async -> Bool
    /// False while the identity store exists but cannot be read — only before a device's first
    /// unlock. Gates the drain, never capture: a row captured in that window carries no client id
    /// and lands unattributed, where gating capture too would drop it entirely.
    private let identityReadable: @Sendable () async -> Bool
    private let resolveMerchantId: @Sendable () async -> String?
    private let signProof: @Sendable (ProofOp, String, Data) async -> String?
    private let now: @Sendable () -> Date
    private let newKey: @Sendable () -> String

    private var backoff: Backoff
    private var drainTask: Task<Void, Never>?
    /// Set when the queue changes under a running drain, so it loops once more.
    private var drainAgain = false
    /// Bumped every time `drainTask` is replaced or cleared, so a finishing drain can tell
    /// whether the slot still holds it before nilling it out.
    private var drainToken = 0
    /// Set once by `shutdown()`, never cleared: a torn-down outbox starts no further drains.
    private var stopped = false
    /// Memoised across one drain's rows. Outer nil: not attempted. Inner nil: attempted, nothing
    /// resolved. Actor state, not a captured `var`, which Swift 6 forbids in a `@Sendable`.
    private var drainMerchantId: String??

    init(
        queue: EventQueue,
        http: HTTPClient,
        logger: FrakLogger,
        senders: [String: any RowSender],
        currentClientId: @escaping @Sendable () async -> String?,
        resolveMerchantId: @escaping @Sendable () async -> String?,
        signProof: @escaping @Sendable (ProofOp, String, Data) async -> String?,
        trackingAllowed: @escaping @Sendable () async -> Bool = { true },
        identityReadable: @escaping @Sendable () async -> Bool = { true },
        now: @escaping @Sendable () -> Date = { Date() },
        newKey: @escaping @Sendable () -> String = { UUID().uuidString.lowercased() },
        backoff: Backoff = Backoff()
    ) {
        self.queue = queue
        self.http = http
        self.logger = logger
        self.senders = senders
        self.currentClientId = currentClientId
        self.resolveMerchantId = resolveMerchantId
        self.signProof = signProof
        self.trackingAllowed = trackingAllowed
        self.identityReadable = identityReadable
        self.now = now
        self.newKey = newKey
        self.backoff = backoff
    }

    func track(merchantId: String?, clientId: String?, interaction: Interaction) async {
        let key = idempotencyKey(for: interaction)
        let body = interactionBody(interaction: interaction, idempotencyKey: key)
        await enqueue(
            kind: Self.interactionKind,
            payload: body,
            clientId: clientId,
            merchantId: merchantId,
            idempotencyKey: key
        )
        detachDrain()
    }

    func trackPurchase(
        merchantId: String?,
        clientId: String?,
        customerId: String,
        orderId: String,
        token: String
    ) async {
        // No idempotency key: the purchase route carries no such field and reconciles on
        // `(orderId, token)` server-side.
        let body = Self.json([
            "customerId": customerId,
            "orderId": orderId,
            "token": token,
        ])
        await enqueue(
            kind: Self.purchaseKind,
            payload: body,
            clientId: clientId,
            merchantId: merchantId,
            idempotencyKey: newKey()
        )
        detachDrain()
    }

    /// Enqueues an identity merge. `clientId` MUST be the anonymousId being folded in: it is
    /// what lets the drain's stale-id guard drop this row after an identity reset instead of
    /// posting a merge for an identity the caller already walked away from.
    func trackMerge(mergeToken: String, anonymousId: String, merchantId: String?) async {
        // A token already on disk was claimed by a previous process, whose in-memory guard died
        // with it; without this, every cold start on the same intent would queue it again.
        // Checked here rather than by the caller so the check and the append are one hop into
        // this actor: two of them would let interleaved calls both pass before either appends.
        guard await !isQueued(kind: Self.mergeKind, idempotencyKey: mergeToken) else { return }
        await enqueue(
            kind: Self.mergeKind,
            payload: "{}",
            clientId: anonymousId,
            merchantId: merchantId,
            idempotencyKey: mergeToken
        )
        detachDrain()
    }

    /// [idempotencyKey] is the token itself for a merge row; it never reaches the wire from there.
    private func isQueued(kind: String, idempotencyKey: String) async -> Bool {
        await queue.read(now: now()).contains { $0.kind == kind && $0.idempotencyKey == idempotencyKey }
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

    /// Cancels an in-flight drain and refuses to start another, so `DefaultFrakClient.shutdown()`
    /// leaves nothing running and nothing able to start. One-way: a torn-down outbox is dead.
    ///
    /// The refusal is the load-bearing half — `scheduleDrain` uses `Task.init`, which does not
    /// inherit cancellation, so the next `track()` would start a fresh, uncancelled drain. Does
    /// not await the cancelled task; queued events survive on disk, since this is not an erasure.
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
        // Mirrors `AnonymousIdStore.generationToken`: the tail has to know whether `drainTask`
        // still holds THIS task, and a closure cannot capture the `let` being assigned to it.
        //
        // Without it, a `track()` racing `shutdown()` ends up with two concurrent drains over one
        // queue file — two writers, which `EventQueue` does not serialise.
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

    /// A `SendContext` for one drain, with `resolveMerchantId` memoised for that drain's
    /// lifetime. `[weak self]`: a strong capture here would be a retain cycle through
    /// `drainTask`, and the memo itself must live on the actor, not in the closure.
    private func makeSendContext() -> SendContext {
        drainMerchantId = nil
        return SendContext(
            http: http,
            resolveMerchantId: { [weak self] in
                guard let self else { return nil }
                return await self.memoizedMerchantId()
            },
            signProof: signProof
        )
    }

    private func memoizedMerchantId() async -> String? {
        // `if let` because `??` is an autoclosure and rejects `await` on its right-hand side.
        if let cached = drainMerchantId { return cached }
        let resolved = await resolveMerchantId()
        drainMerchantId = resolved
        return resolved
    }

    private func drain() async {
        // Checked before the read, so a drain started by a `track()` that raced a consent
        // withdrawal never even loads the backlog. The per-event re-read below is what closes
        // the withdrawal-lands-mid-drain window; this one just avoids the pointless work.
        guard await trackingAllowed() else { return }
        // Returns before the read, leaving the file as found. An unreadable identity store yields
        // a nil id, which disables the stale-id guard below rather than tightening it.
        guard await identityReadable() else { return }
        guard !backoff.isBackingOff(Self.backoffKey) else { return }

        let pending = await queue.read(now: now())
        guard !pending.isEmpty else {
            // Nothing to send, but expired rows may still be on disk. `reconcile` rather than
            // `replace([])`: read and write must be one hop, or a `track` appending between
            // them is read by neither and erased by the second.
            await queue.reconcile(delivered: [], retried: [:], now: now())
            return
        }

        let currentId = await currentClientId()
        let ctx = makeSendContext()
        var delivered: Set<Int64> = []
        var retried: [Int64: QueuedRow] = [:]

        eventLoop: for event in pending {
            // `break`, not `return`: the caller that flipped consent is about to `purge()`, but a
            // purge that does not land leaves every event this drain already uploaded on disk with
            // no record it went, and `Interaction.arrival` carries no idempotency key — a
            // duplicated referral payout. The cancellation path below must `return` instead.
            guard await trackingAllowed() else {
                logger.info("Tracking was disabled mid-drain; stopping without sending the rest.")
                break eventLoop
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

            guard let sender = senders[event.kind] else { continue }

            let outcome: DeliveryOutcome
            do {
                outcome = try await sender.deliver(row: event, ctx: ctx)
            } catch {
                // Cancellation only — `deliver` is typed `throws(CancellationError)`. Returning
                // skips the reconcile: compacting away an undelivered event is unrecoverable.
                return
            }

            switch outcome {
            case .delivered:
                backoff.recordSuccess(Self.backoffKey)
                delivered.insert(rowId)
            case .dropped:
                delivered.insert(rowId)
            case .retryable(let error):
                backoff.recordFailure(Self.backoffKey, from: error)
                break eventLoop
            case .rejected:
                let failed = event.withFailure()
                if failed.failures >= Self.maxFailures {
                    logger.warn("Dropping a row the backend keeps rejecting (kind \(event.kind)).")
                    delivered.insert(rowId)
                } else {
                    retried[rowId] = failed
                }
                break eventLoop
            case .hold:
                // heldSince is never cleared once set, so this measures total time stuck, not
                // time since the row was last attempted.
                if let heldSince = event.heldSince {
                    guard now().timeIntervalSince(heldSince) > sender.holdTimeout else {
                        break eventLoop
                    }
                    logger.warn(
                        "Dropping a row held past its budget (kind \(event.kind), held \(Int(now().timeIntervalSince(heldSince)))s)."
                    )
                    delivered.insert(rowId)
                    continue eventLoop
                }
                retried[rowId] = event.withHeldSince(now())
                break eventLoop
            }
        }

        // Re-read rather than write back `pending`: a `track` that landed while the drain was
        // awaiting the network is in the file now, and must not be compacted away.
        await queue.reconcile(delivered: delivered, retried: retried, now: now())
    }

    private func enqueue(
        kind: String,
        payload: String,
        clientId: String?,
        merchantId: String?,
        idempotencyKey: String
    ) async {
        await queue.append(
            QueuedRow(
                idempotencyKey: idempotencyKey,
                kind: kind,
                payload: payload,
                clientId: clientId,
                merchantId: merchantId,
                capturedAt: now()
            )
        )
    }

    private func idempotencyKey(for interaction: Interaction) -> String {
        if case .custom(_, _, let supplied) = interaction.kind, let supplied {
            return supplied
        }
        return newKey()
    }

    /// `merchantId` is deliberately absent: a `RowSender` injects it at send time from
    /// `QueuedRow.merchantId`, which is what lets a row be captured before any merchant is known.
    private func interactionBody(interaction: Interaction, idempotencyKey: String) -> String {
        switch interaction.kind {
        case .arrival(let wallet, let clientId, let referrerMerchantId, let timestamp):
            return Self.json([
                "type": "arrival",
                "referrerWallet": wallet,
                "referrerClientId": clientId,
                "referrerMerchantId": referrerMerchantId,
                "referralTimestamp": timestamp,
            ])
        case .sharing(let timestamp, let purchaseId):
            return Self.json([
                "type": "sharing",
                // Unix seconds, stamped now and stored: a retry must not restamp it.
                "sharingTimestamp": timestamp ?? Int64(now().timeIntervalSince1970),
                "purchaseId": purchaseId,
                "idempotencyKey": idempotencyKey,
            ])
        case .custom(let customType, let data, _):
            return Self.json([
                "type": "custom",
                "customType": customType,
                "data": data,
                "idempotencyKey": idempotencyKey,
            ])
        }
    }

    /// Sorted keys so a body is byte-identical every time it is built; the queue stores it
    /// verbatim. Nil-valued keys are absent rather than JSON null, matching the Kotlin twin.
    ///
    /// Every value here is a `String`, `Int64` or `[String: String]`, so the fallback is
    /// unreachable — a fallback rather than a trap, since an SDK does not get to bring down
    /// its host over a body it failed to build.
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
