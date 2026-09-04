import CryptoKit
import Foundation

/// This installation's anonymous id: `uuid_from(SHA-256(P-256 pubkey)[0..16])`, so it is
/// self-authenticating rather than asserted. Scoped to one install — a reinstall is a new user.
/// Nothing throws: a device that refuses key material yields nil and tracking goes inert.
actor AnonymousIdStore {
    /// Which merchant this installation's id belongs to, so a rebuild pointed at a different
    /// one regenerates instead of carrying a stale identity across.
    static let merchantMarkerKey = "merchant"

    private struct Identity {
        let key: DeviceKey
        let id: String
    }

    private let keyStore: DeviceKeyStore
    private let store: KeyValueStore
    private let logger: FrakLogger
    private let merchantMarker: String
    /// Read fresh at both gate sites below, never captured, so a withdrawal mid-session stops
    /// the next mint immediately.
    private let consent: TrackingConsent

    private var generation: Task<Identity?, Never>?

    /// Bumped whenever `generation` is replaced, so a task that resolved to nil can tell it is
    /// still the current generation before clearing the slot.
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

    /// Starts the keystore mint now, so a later `anonymousId()` usually awaits a completed task.
    /// `async` only for the consent hop — it never awaits the mint itself.
    func startEagerGeneration() async {
        guard await consent.isEnabled() else { return }
        _ = generationTask()
    }

    /// Nil when tracking is off or the device refused to produce key material. Awaits the
    /// in-flight or already-completed generation; never nil purely on a timing race.
    func anonymousId() async -> String? {
        await identity()?.id
    }

    /// False only before a device's first unlock, where the identity on disk is intact but its
    /// file protection class still holds. Callers use it to tell "no identity" apart from "not
    /// yet", which read the same through [anonymousId].
    var isReadable: Bool {
        store.isReadable
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

    /// Destroys the keypair, so the next read mints a new identity. False when the key store
    /// refused to erase it, exactly as on Android — merchants share erasure logic across both, so
    /// this must not answer true for an erasure that did not happen.
    ///
    /// Clears `generation` first, so a mint in flight cannot publish the destroyed identity.
    @discardableResult
    func reset() -> Bool {
        // Cancelled before being cleared: an in-flight `load()` racing this call must not write
        // `merchantMarker` back after `removeValue` below removes it (see `load`'s cancellation
        // check).
        generation?.cancel()
        generation = nil
        generationToken += 1
        let erased = keyStore.delete()
        store.removeValue(forKey: Self.merchantMarkerKey)
        return erased
    }

    /// Awaits the in-flight or completed generation. A refusal is never cached — a keystore can
    /// refuse transiently, and caching that would leave the install tracking-dead for good.
    ///
    /// `task.isCancelled` is checked apart from `value == nil`, because `load` has no suspension
    /// point for `reset()`'s cancel to bite at: a caller already awaiting would otherwise be
    /// handed the stale, just-deleted identity.
    private func identity() async -> Identity? {
        // Consent first, so a denial short-circuits ahead of any keystore work. The await is a
        // suspension point, but re-entry is safe: the task and its token are read with none
        // between them. A withdrawal landing inside it lets the mint finish — that is a pause,
        // not an erasure.
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
            // A `reset()` racing this generation already removed the marker; writing it back
            // would resurrect it for a key this generation does not own.
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
