import CryptoKit
import Foundation

@testable import FrakSDK

/// `DeviceKeyStore` with no platform underneath — testable without a Secure Enclave. Counts
/// keypairs minted; that count is what "regenerated" means here.
final class FakeDeviceKeyStore: DeviceKeyStore, @unchecked Sendable {
    private let lock = NSLock()
    private var key: DeviceKey?
    private var mints = 0
    private var refuses: Bool
    private var refusesDelete = false

    init(failOnCreate: Bool = false) {
        self.refuses = failOnCreate
    }

    /// Models a store that cannot erase — a full disk, or one not readable before first unlock.
    var refusesDeletion: Bool {
        get {
            lock.lock()
            defer { lock.unlock() }
            return refusesDelete
        }
        set {
            lock.lock()
            defer { lock.unlock() }
            refusesDelete = newValue
        }
    }

    /// Settable: a test can model a keystore that refuses once, then recovers.
    var failOnCreate: Bool {
        get {
            lock.lock()
            defer { lock.unlock() }
            return refuses
        }
        set {
            lock.lock()
            defer { lock.unlock() }
            refuses = newValue
        }
    }

    var creations: Int {
        lock.lock()
        defer { lock.unlock() }
        return mints
    }

    func loadOrCreate() throws -> DeviceKey {
        lock.lock()
        defer { lock.unlock() }
        if refuses {
            throw InvalidProofInput(description: "keystore unavailable")
        }
        if let key { return key }
        let fresh = DeviceKey.software(P256.Signing.PrivateKey())
        key = fresh
        mints += 1
        return fresh
    }

    func delete() -> Bool {
        lock.lock()
        defer { lock.unlock() }
        key = nil
        return !refusesDelete
    }
}
