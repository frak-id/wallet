import CryptoKit
import Foundation

/// This installation's anonymous id, derived from a device-held P-256 keypair so it is
/// self-authenticating rather than merely asserted.
///
/// ```text
/// clientId = uuid_from(SHA-256(pubkey_uncompressed)[0..16])   // RFC-4122 v4 bits set
/// ```
///
/// Scoped to one installation: a reinstall is a new user, like clearing site data on the web.
/// Nothing here throws — a device that refuses key material yields nil, and tracking goes
/// inert rather than the SDK failing a merchant's call.
///
/// An actor rather than a class with a lock: actor isolation gives the same mutual exclusion,
/// and `startEagerGeneration` lets a caller racing the warm-up await the same in-flight `Task`
/// instead of re-entering `load`.
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
    /// Runtime consent handle, read fresh at both gate sites below rather than captured once,
    /// so a withdrawal mid-session stops the next mint immediately instead of only after the
    /// merchant's app is relaunched.
    ///
    /// Two gates here, one on Android: `startEagerGeneration()` makes the cross-actor read
    /// itself before deciding whether to start a `Task`, where the Kotlin twin can defer that
    /// decision to `current()`.
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
    /// `async` because the consent read is a cross-actor hop; it awaits only that decision, not
    /// the mint itself, so this stays the fire-and-forget warm-up its caller expects.
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
    /// Always returns true on this platform: `DeviceKeyStore.delete()` is non-throwing,
    /// backed by a `UserDefaults` removal, not the Keychain or Secure Enclave. The value
    /// exists so a merchant writing shared cross-platform erasure logic has one contract to
    /// check — the equivalent call can genuinely fail on Android.
    ///
    /// Clears `generation` before touching storage: a generation already in flight when
    /// `reset()` runs can then no longer publish the OLD identity afterwards, because the next
    /// `anonymousId()` call sees `generation == nil` and starts a brand new one rather than
    /// awaiting the stale one.
    @discardableResult
    func reset() -> Bool {
        // Cancelled before being cleared: an in-flight `load()` racing this call must not write
        // `merchantMarker` back after `removeValue` below removes it (see `load`'s cancellation
        // check).
        generation?.cancel()
        generation = nil
        generationToken += 1
        keyStore.delete()
        store.removeValue(forKey: Self.merchantMarkerKey)
        return true
    }

    /// Awaits the in-flight or already-completed generation. A refusal is never cached: a
    /// keystore can refuse for reasons that pass (unavailable before first unlock, a transient
    /// Secure Enclave hiccup), and caching it would turn one refusal into an install that never
    /// tracks again. A task that resolves to nil clears `generation` afterwards, but only if
    /// `generationToken` is still the token this call started with — otherwise a newer
    /// generation already replaced it and this leaves it alone.
    ///
    /// `task.isCancelled` is checked separately from `value == nil`: `load` is synchronous,
    /// non-cooperative code with no suspension point to stop at, so `reset()`'s
    /// `generation?.cancel()` never actually stops the keystore work in flight, only flips
    /// `Task.isCancelled`. Without this check, a caller already suspended on `await task.value`
    /// when `reset()` ran would receive the stale, just-deleted identity.
    private func identity() async -> Identity? {
        // Checked before `generation` is read, so a denied consent short-circuits ahead of any
        // keystore work, including on the first launch of a build that reads a denial already
        // on disk.
        //
        // Default is `trackingEnabled: true` with no recorded decision, treated as permitted
        // (see `TrackingConsent`'s table), so the keypair mints on first launch before any CMP
        // has spoken.
        //
        // This await is a suspension point, so the call can be re-entered before touching
        // `generation` — safe since `generationTask()` and `generationToken` are read with no
        // suspension between them right after. A withdrawal landing inside this await lets that
        // mint complete: `setTrackingEnabled(false)` deliberately doesn't cancel an in-flight
        // generation, unlike `reset()`, because it is a pause, not an erasure.
        guard await consent.isEnabled() else { return nil }
        let task = generationTask()
        let token = generationToken
        let value = await task.value
        // Checked after awaiting: `reset()` can run while this is suspended on
        // `await task.value`, so cancellation is only observable once the await returns.
        // `task.value` still resolves to `load`'s real result even when cancelled; this
        // discards it.
        if task.isCancelled {
            return nil
        }
        if value == nil, generationToken == token {
            generation = nil
        }
        return value
    }

    /// Non-optional: the consent gate lives in the two async callers, which can make the
    /// cross-actor read this function cannot.
    private func generationTask() -> Task<Identity?, Never> {
        if let generation { return generation }
        // Task.detached, not Task { }: a non-detached Task inherits the actor's executor, so
        // the keystore/Secure Enclave work would run on the actor and serialise every other
        // actor method behind it. `load` is `nonisolated` so it is callable from a detached
        // context without hopping back here.
        let keyStore = keyStore
        let store = store
        let logger = logger
        let merchantMarker = merchantMarker
        let task = Task.detached(priority: .userInitiated) {
            Self.load(keyStore: keyStore, store: store, logger: logger, merchantMarker: merchantMarker)
        }
        generation = task
        // Bumped here too, not only in `reset()`: the token identifies which generation is
        // current, not just whether a reset happened. Otherwise a stale task resolving to nil
        // could clear a newer, already-installed task and discard a live identity.
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
