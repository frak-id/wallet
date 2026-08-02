import CryptoKit
import Foundation

@testable import FrakSDK

/// `DeviceKeyStore` with no platform underneath, so identity behaviour is testable without
/// a Secure Enclave. Counts keypairs minted, which is what "regenerated" actually means.
final class FakeDeviceKeyStore: DeviceKeyStore, @unchecked Sendable {
    private let lock = NSLock()
    private var key: DeviceKey?
    private var mints = 0
    private var refuses: Bool

    init(failOnCreate: Bool = false) {
        self.refuses = failOnCreate
    }

    /// Settable, so a test can model a keystore that refuses once and then recovers. Whether
    /// the second call succeeds is the whole question behind not caching the failure.
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

    func delete() {
        lock.lock()
        defer { lock.unlock() }
        key = nil
    }
}
