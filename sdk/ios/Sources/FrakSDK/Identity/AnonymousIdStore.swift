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
final class AnonymousIdStore: @unchecked Sendable {
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
    private let trackingEnabled: Bool

    /// Guards `identity`, and serialises the keystore work that mints it. Plain locking
    /// rather than an actor because `FrakClient.anonymousId` is synchronous: the first read
    /// touches storage, every later one is a field read.
    private let lock = NSLock()
    private var identity: Identity?

    init(
        keyStore: DeviceKeyStore,
        store: KeyValueStore,
        logger: FrakLogger,
        merchantMarker: String,
        trackingEnabled: Bool
    ) {
        self.keyStore = keyStore
        self.store = store
        self.logger = logger
        self.merchantMarker = merchantMarker
        self.trackingEnabled = trackingEnabled
    }

    /// Nil when tracking is off or the device refused to produce key material.
    func anonymousId() -> String? {
        current()?.id
    }

    /// A base64url proof that this device holds the key behind `anonymousId`, or nil when
    /// there is no identity or the platform refused to sign.
    func signProof(
        _ op: ProofOp,
        merchantId: String,
        binding: Data = Data(),
        ts: Int64 = Int64(Date().timeIntervalSince1970)
    ) -> String? {
        guard let identity = current() else { return nil }
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
    func reset() {
        lock.lock()
        defer { lock.unlock() }
        identity = nil
        keyStore.delete()
        store.removeValue(forKey: Self.merchantMarkerKey)
    }

    private func current() -> Identity? {
        guard trackingEnabled else { return nil }
        lock.lock()
        defer { lock.unlock() }
        if let identity { return identity }
        identity = load()
        return identity
    }

    private func load() -> Identity? {
        do {
            if let marker = store.string(forKey: Self.merchantMarkerKey), marker != merchantMarker {
                logger.info("Merchant changed for this install; regenerating the anonymous id.")
                keyStore.delete()
            }
            let key = try keyStore.loadOrCreate()
            store.set(merchantMarker, forKey: Self.merchantMarkerKey)
            let hash = Data(SHA256.hash(data: key.publicKeyUncompressed))
            return Identity(key: key, id: try ProofCodec.clientId(fromHash: hash))
        } catch {
            logger.error("Could not derive an anonymous id; tracking will be inert.", error)
            return nil
        }
    }
}
