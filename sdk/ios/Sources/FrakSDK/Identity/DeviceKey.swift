import CryptoKit
import Foundation
import Security

// P-256 keypair this installation's anonymous id is derived from. Secure Enclave when available,
// software otherwise. `@unchecked Sendable`: immutable value types over key material fixed at
// creation, which CryptoKit does not state itself.
enum DeviceKey: @unchecked Sendable {
    case secureEnclave(SecureEnclave.P256.Signing.PrivateKey)
    case software(P256.Signing.PrivateKey)

    // SEC 1 uncompressed point, 65 bytes: 0x04 + X(32) + Y(32).
    var publicKeyUncompressed: Data {
        switch self {
        case .secureEnclave(let key): key.publicKey.x963Representation
        case .software(let key): key.publicKey.x963Representation
        }
    }

    // ECDSA over SHA-256, raw r+s (64 bytes, never DER).
    func sign(_ message: Data) throws -> Data {
        switch self {
        case .secureEnclave(let key): try key.signature(for: message).rawRepresentation
        case .software(let key): try key.signature(for: message).rawRepresentation
        }
    }
}

protocol DeviceKeyStore: Sendable {
    func loadOrCreate() throws -> DeviceKey
    func delete()
}

// DeviceKeyStore over a `KeyValueStore`, not the Keychain: Keychain items survive uninstall, which
// would resurrect a cross-install identifier.
//
// What lands there is not always a key reference — `.software` persists the raw P-256 scalar — so
// the caller must back this with backup-excluded storage (see `FileKeyValueStore`), or a restore
// clones the identity onto the new device.
struct PersistedDeviceKeyStore: DeviceKeyStore {
    // One byte in front of key material so a blob from one backing never reaches the other.
    private enum Backing: UInt8 {
        case secureEnclave = 1
        case software = 2
    }

    static let storageKey = "device-key"

    private let store: KeyValueStore
    private let logger: FrakLogger

    /// Silent by default so the tests, which construct this directly, need no sink.
    init(store: KeyValueStore, logger: FrakLogger = FrakLogger(level: .none)) {
        self.store = store
        self.logger = logger
    }

    // Stored material this device cannot use is replaced, not preserved: an iCloud restore carries
    // the blob but not the Secure Enclave key that wraps it, so that id is already unrecoverable.
    // Unusable is not graded, but the material is deliberately not cleared here — `generate()`
    // overwrites it on success, and clearing on a failing path would destroy a healthy key.
    func loadOrCreate() throws -> DeviceKey {
        if let key = load() { return key }
        // An unreadable store reads as empty, so minting here would replace an identity that is
        // present and healthy, just locked. Refused instead: the caller is left without an id for
        // this session and retries once the device is unlocked.
        guard store.isReadable else {
            throw InvalidProofInput(description: "the identity store is not readable yet")
        }
        let (key, blob) = try generate()
        store.set(Base64URL.encode(blob), forKey: Self.storageKey)
        return key
    }

    /// Nil both when there is nothing stored and when what is stored cannot be used here, so
    /// `loadOrCreate` mints either way. The Android twin has the same shape for the same reason.
    private func load() -> DeviceKey? {
        guard let stored = store.string(forKey: Self.storageKey) else { return nil }
        guard let blob = Base64URL.decode(stored) else { return nil }
        return try? Self.restore(blob)
    }

    func delete() {
        store.removeValue(forKey: Self.storageKey)
    }

    private func generate() throws -> (DeviceKey, Data) {
        // Logged, not guarded to the simulator: refusing here would leave a host with no enclave
        // (a simulator, Catalyst on a pre-T2 Mac) permanently unable to track, silently. The raw
        // scalar this path persists is only safe because the store is backup-excluded, so a build
        // that reports this line on a real device is a signal the wiring regressed.
        guard SecureEnclave.isAvailable else {
            logger.warn("No Secure Enclave on this host; the device key will be held in software.")
            let key = P256.Signing.PrivateKey()
            return (.software(key), Data([Backing.software.rawValue]) + key.rawRepresentation)
        }
        // afterFirstUnlock, not whenUnlocked: SDK signs from background work too.
        guard
            let access = SecAccessControlCreateWithFlags(
                nil,
                kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
                .privateKeyUsage,
                nil
            )
        else {
            throw InvalidProofInput(description: "the platform refused to build a key access policy")
        }
        let key = try SecureEnclave.P256.Signing.PrivateKey(accessControl: access)
        return (.secureEnclave(key), Data([Backing.secureEnclave.rawValue]) + key.dataRepresentation)
    }

    private static func restore(_ blob: Data) throws -> DeviceKey {
        guard let tag = blob.first, let backing = Backing(rawValue: tag) else {
            throw InvalidProofInput(description: "stored key material carries no known backing tag")
        }
        let material = blob.dropFirst()
        switch backing {
        case .secureEnclave:
            return .secureEnclave(try SecureEnclave.P256.Signing.PrivateKey(dataRepresentation: material))
        case .software:
            return .software(try P256.Signing.PrivateKey(rawRepresentation: material))
        }
    }
}
