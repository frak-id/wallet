import CryptoKit
import Foundation
import Security

// P-256 keypair this installation's anonymous id is derived from. Secure Enclave when
// available (private key never leaves the chip), software otherwise (simulator).
// @unchecked Sendable: immutable value types over key material fixed at creation;
// CryptoKit doesn't state the conformance itself.
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

// DeviceKeyStore over the SDK's own UserDefaults suite. Not the Keychain, deliberately:
// Keychain items survive uninstall, which would resurrect a cross-install identifier
// (inconsistent with Android/web, where reinstall/clearing data resets the id).
// Stores a key reference, not the key itself (Secure Enclave blob is chip-wrapped).
struct PersistedDeviceKeyStore: DeviceKeyStore {
    // One byte in front of key material so a blob from one backing never reaches the other.
    private enum Backing: UInt8 {
        case secureEnclave = 1
        case software = 2
    }

    static let storageKey = "device-key"

    private let store: KeyValueStore

    init(store: KeyValueStore) {
        self.store = store
    }

    // Throws (never regenerates) when key material is present but unusable, since
    // regenerating would irrecoverably rotate the anonymous id.
    func loadOrCreate() throws -> DeviceKey {
        if let stored = store.string(forKey: Self.storageKey) {
            guard let blob = Base64URL.decode(stored) else {
                throw InvalidProofInput(description: "stored key material is not base64url")
            }
            return try Self.restore(blob)
        }
        let (key, blob) = try Self.generate()
        store.set(Base64URL.encode(blob), forKey: Self.storageKey)
        return key
    }

    func delete() {
        store.removeValue(forKey: Self.storageKey)
    }

    private static func generate() throws -> (DeviceKey, Data) {
        guard SecureEnclave.isAvailable else {
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
