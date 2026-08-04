import CryptoKit
import Foundation

/// This installation's anonymous id, derived from a device-held P-256 keypair so it is
/// self-authenticating rather than merely asserted.
///
/// ```text
/// clientId = uuid_from(SHA-256(pubkey_uncompressed)[0..16])   // RFC-4122 v4 bits set
/// ```
///
/// Scoped to one installation: a reinstall is a new user, exactly as clearing site data is
/// on the web. Nothing here throws — a device that refuses key material yields nil, and
/// tracking goes inert rather than the SDK failing a merchant's call.
/// 4.5: an actor, not a class with `NSLock` — generation is suspend/async now, so the lock that
/// existed only because `anonymousId()` was synchronous is unnecessary; actor isolation gives the
/// same mutual exclusion for free. [startEagerGeneration] mints the keypair as soon as this store
/// exists; a caller racing that warm-up awaits the SAME in-flight `Task` instead of redundantly
/// re-entering `load` behind a lock.
actor AnonymousIdStore {
    /// Which merchant this installation's id belongs to, so a rebuild pointed at a
    /// different one regenerates rather than carrying the old identity across.
    static let merchantMarkerKey = "merchant"

    private struct Identity {
        let key: DeviceKey
        let id: String
    }

    private let keyStore: DeviceKeyStore
    private let store: KeyValueStore
    private let logger: FrakLogger
    private let merchantMarker: String
    /// S6a/C7: the runtime consent handle, not the build-time `FrakConfig.trackingEnabled` bool
    /// this used to be. Read fresh at both gate sites below rather than captured once, so a
    /// `setTrackingEnabled(false)` mid-session actually stops the next mint instead of taking
    /// effect only after the merchant's app is relaunched.
    ///
    /// Two gates here, one on Android: `startEagerGeneration()` has to make the cross-actor read
    /// itself before it can decide whether to start a `Task` at all, whereas the Kotlin twin's
    /// equivalent only launches into a scope and can defer the whole decision to `current()`.
    private let consent: TrackingConsent

    private var generation: Task<Identity?, Never>?

    /// Bumped every time `generation` is replaced (a fresh mint, or `reset()`), so a task that
    /// resolved to nil can tell whether it is still the current generation before clearing the
    /// slot — see `identity()`.
    private var generationToken = 0

    init(
        keyStore: DeviceKeyStore,
        store: KeyValueStore,
        logger: FrakLogger,
        merchantMarker: String,
        consent: TrackingConsent
    ) {
        self.keyStore = keyStore
        self.store = store
        self.logger = logger
        self.merchantMarker = merchantMarker
        self.consent = consent
    }

    /// Starts the keystore mint now, off whichever thread calls this. Called once by
    /// `DefaultFrakClient.init`, so a later `anonymousId()` read usually awaits an
    /// already-completed `Task` rather than starting the round-trip itself.
    ///
    /// `async` since S6a/C7: the consent read is a cross-actor hop. It still does not await the
    /// mint itself — only the decision of whether to start one — so this stays the fire-and-forget
    /// warm-up its caller expects.
    func startEagerGeneration() async {
        guard await consent.isEnabled() else { return }
        _ = generationTask()
    }

    /// Nil when tracking is off or the device refused to produce key material. Awaits the
    /// in-flight or already-completed generation; never nil purely on a timing race.
    func anonymousId() async -> String? {
        await identity()?.id
    }

    /// A base64url proof that this device holds the key behind `anonymousId`, or nil when
    /// there is no identity or the platform refused to sign.
    func signProof(
        _ op: ProofOp,
        merchantId: String,
        binding: Data = Data(),
        ts: Int64 = Int64(Date().timeIntervalSince1970)
    ) async -> String? {
        guard let identity = await identity() else { return nil }
        do {
            let message = try ProofCodec.message(
                op: op,
                merchantId: merchantId,
                anonymousId: identity.id,
                binding: binding,
                ts: ts
            )
            let signature = try identity.key.sign(message)
            return try ProofCodec.proof(
                publicKey: identity.key.publicKeyUncompressed,
                ts: ts,
                signature: signature
            )
        } catch {
            logger.warn("Could not sign a \(op.rawValue) proof", error)
            return nil
        }
    }

    /// Destroys the keypair, so the next read mints a new identity. Everything already
    /// attributed to the old id stays with it — this severs the device from that id.
    ///
    /// `Bool`, matching the Android twin now (4fp), where the return value distinguishes a
    /// genuine keystore failure from success. This platform's `delete()` cannot itself fail —
    /// `DeviceKeyStore.delete()` is non-throwing by protocol (`DeviceKey.swift`) and its one
    /// production conformance, `PersistedDeviceKeyStore`, is a `KeyValueStore.removeValue` call —
    /// itself non-throwing by protocol, backed by `UserDefaults` removal, never the Keychain or
    /// Secure Enclave (deletion only ever drops the stored key *reference*; the Secure Enclave
    /// path is exercised on generation, not on delete) — so this always returns true. The value
    /// exists so a merchant writing shared cross-platform erasure logic has one contract to check
    /// rather than two: overriding this platform's local asymmetry in favour of the one that
    /// carries a real legal-compliance obligation is deliberate, not an oversight.
    ///
    /// Clearing `generation` before touching storage (rather than after) closes a race the
    /// `NSLock`-based version had: a generation already in flight when `reset()` runs can no
    /// longer publish the OLD identity afterwards, because the next `anonymousId()` call sees
    /// `generation == nil` and starts a brand new one rather than awaiting the stale one.
    @discardableResult
    func reset() -> Bool {
        // Cancelled before being cleared: an in-flight `load()` racing this call must not write
        // `merchantMarker` back after `removeValue` below removes it (see `load`'s cancellation
        // check). Cancellation never changes what THIS call returns — deletion on this platform
        // cannot fail regardless of what an in-flight generation was doing.
        generation?.cancel()
        generation = nil
        generationToken += 1
        keyStore.delete()
        store.removeValue(forKey: Self.merchantMarkerKey)
        return true
    }

    /// Awaits the in-flight or already-completed generation. A refusal is never cached (see the
    /// KDoc on the recovery test): a keystore can refuse for reasons that pass — key operations
    /// unavailable before first unlock, a transient Secure Enclave hiccup — and caching the
    /// failure would turn one refusal into an install that never tracks again. So a `Task` that
    /// resolves to nil clears `generation` afterwards — but ONLY if `generationToken` is still the
    /// token this call started with. That check is what makes the clear race-safe: if `reset()` or
    /// a newer generation already ran while this was awaiting, the token has moved on, and this
    /// call leaves `generation` alone instead of clobbering something newer than the failure it
    /// observed.
    ///
    /// `task.isCancelled` is checked separately from `value == nil`: `generation` is a
    /// `Task.detached` running `load`, which is synchronous, non-cooperative code with no
    /// suspension point to actually stop at. `reset()`'s `generation?.cancel()` therefore never
    /// stops the keystore work in flight — it only flips `Task.isCancelled`, which `load` checks
    /// once, to skip resurrecting the merchant marker. The task still runs to completion and
    /// `.value` still resolves to the OLD, just-deleted identity. Without this check, a caller
    /// already suspended on `await task.value` when `reset()` ran would receive that stale
    /// identity and hand it back to `anonymousId()`/`signProof` — publishing an id `reset()` just
    /// erased. Android does not need this: `Deferred.cancel()` makes `await()` throw immediately,
    /// which `awaitAndDropIfFailed` maps to null. This mirrors that outcome without a real
    /// cancellation point to rely on.
    private func identity() async -> Identity? {
        // The load-bearing gate (`startEagerGeneration` has the other, but only a caller reaching
        // here can mint on demand). Checked before `generation` is read, so a DENIED consent
        // short-circuits ahead of any keystore work — including on the first launch of a build that
        // reads a denial already on disk, which is what makes "denied consent, no key material"
        // true rather than merely claimed.
        //
        // Note what that does NOT say. The shipped default is `trackingEnabled: true` with no
        // recorded decision, which this treats as permitted (see `TrackingConsent`'s table), so the
        // keypair IS minted on first launch before any CMP has spoken.
        //
        // This `await` is a new suspension point ahead of every actor-isolated read below, so this
        // call can now be re-entered before it touches `generation`. That is safe for the token
        // invariant — `generationTask()` and `generationToken` are read on the next two lines with
        // no suspension between them, so `token` still names the task it was read beside. What it
        // does NOT prevent is a withdrawal landing inside this very `await`: that mint completes.
        // `reset()` cancels an in-flight generation; `setTrackingEnabled(false)` deliberately does
        // not, because it is a pause, not an erasure.
        guard await consent.isEnabled() else { return nil }
        let task = generationTask()
        let token = generationToken
        let value = await task.value
        // Checked AFTER awaiting, not before: the race is `reset()` running WHILE this call is
        // suspended on `await task.value`, so cancellation can only be observed once the await
        // returns. `task.value` still resolves to `load`'s real result even when cancelled —
        // this discards that result rather than returning it.
        if task.isCancelled {
            return nil
        }
        if value == nil, generationToken == token {
            generation = nil
        }
        return value
    }

    /// Non-optional since S6a/C7: the consent gate moved to the two callers, which are `async`
    /// and can therefore make the cross-actor read this function cannot. Nothing else could ever
    /// make it return nil.
    private func generationTask() -> Task<Identity?, Never> {
        if let generation { return generation }
        // Task.detached, not Task { }: a non-detached Task inside an actor inherits the actor's
        // executor, so the keystore/Secure Enclave work would run ON the actor and serialise
        // every other actor method behind it — exactly the blocking 4.5 exists to remove. `load`
        // is `nonisolated` so it is callable from a detached context without hopping back here.
        let keyStore = keyStore
        let store = store
        let logger = logger
        let merchantMarker = merchantMarker
        let task = Task.detached(priority: .userInitiated) {
            Self.load(keyStore: keyStore, store: store, logger: logger, merchantMarker: merchantMarker)
        }
        generation = task
        // Bumped here, not only in `reset()`: `generationToken` identifies WHICH generation is
        // current, not just whether a reset happened. Without this, a task B that is awaiting an
        // older, now-superseded generation could see the token unchanged when it resolves to nil
        // and clear a DIFFERENT, newer task that this call just installed and that may already
        // have succeeded — discarding a live identity and forcing a redundant Secure Enclave round
        // trip. See `identity()`'s doc for the read side of this invariant.
        generationToken += 1
        return task
    }

    private nonisolated static func load(
        keyStore: DeviceKeyStore,
        store: KeyValueStore,
        logger: FrakLogger,
        merchantMarker: String
    ) -> Identity? {
        do {
            if let marker = store.string(forKey: Self.merchantMarkerKey), marker != merchantMarker {
                logger.info("Merchant changed for this install; regenerating the anonymous id.")
                keyStore.delete()
            }
            let key = try keyStore.loadOrCreate()
            // A `reset()` that ran while this was in flight already removed the marker; writing
            // it back here would resurrect it for a key this generation no longer owns.
            if !Task.isCancelled {
                store.set(merchantMarker, forKey: Self.merchantMarkerKey)
            }
            let hash = Data(SHA256.hash(data: key.publicKeyUncompressed))
            return Identity(key: key, id: try ProofCodec.clientId(fromHash: hash))
        } catch {
            logger.error("Could not derive an anonymous id; tracking will be inert.", error)
            return nil
        }
    }
}
