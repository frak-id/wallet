import Foundation
import Testing

@testable import FrakSDK

/// The real store, not a fake, so nothing here asserts on which backing `generate()` picks.
///
/// Gates the suite: an unsigned SPM test binary has no Secure Enclave entitlement, so a skip means
/// the environment, not a regression. Declared outside the suite type because `@Suite` is an
/// attached macro and cannot resolve a static on the type it decorates.
private enum HostKeyMaterial {
    static let isMintable: Bool = {
        (try? PersistedDeviceKeyStore(store: InMemoryKeyValueStore()).loadOrCreate()) != nil
    }()
}

@Suite("PersistedDeviceKeyStore", .enabled(if: HostKeyMaterial.isMintable))
struct PersistedDeviceKeyStoreTests {
    private func seeded(_ blob: String?) -> InMemoryKeyValueStore {
        let values = InMemoryKeyValueStore()
        if let blob {
            values.set(blob, forKey: PersistedDeviceKeyStore.storageKey)
        }
        return values
    }

    @Test("mints a key and persists it")
    func mintsAndPersists() throws {
        let values = seeded(nil)
        let key = try PersistedDeviceKeyStore(store: values).loadOrCreate()

        #expect(key.publicKeyUncompressed.count == 65)
        #expect(values.string(forKey: PersistedDeviceKeyStore.storageKey) != nil)
    }

    @Test("a second store over the same values reads the same key back")
    func reloadsTheSameKey() throws {
        let values = seeded(nil)
        let first = try PersistedDeviceKeyStore(store: values).loadOrCreate()
        let second = try PersistedDeviceKeyStore(store: values).loadOrCreate()

        #expect(first.publicKeyUncompressed == second.publicKeyUncompressed)
    }

    /// A wrong-sized software scalar, not an enclave blob: the length check rejects it on any host.
    @Test("material this device cannot use is replaced, not fatal")
    func discardsMaterialTheDeviceCannotUse() throws {
        let unusable = Base64URL.encode(Data([2]) + Data(repeating: 0xAB, count: 5))
        let values = seeded(unusable)

        let key = try PersistedDeviceKeyStore(store: values).loadOrCreate()

        #expect(key.publicKeyUncompressed.count == 65)
        #expect(values.string(forKey: PersistedDeviceKeyStore.storageKey) != unusable)
    }

    @Test("a blob that is not base64url is discarded")
    func discardsMaterialThatIsNotBase64() throws {
        let values = seeded("!!! not base64url !!!")

        let key = try PersistedDeviceKeyStore(store: values).loadOrCreate()

        #expect(key.publicKeyUncompressed.count == 65)
    }

    @Test("a blob carrying an unknown backing tag is discarded")
    func discardsAnUnknownBackingTag() throws {
        let values = seeded(Base64URL.encode(Data([9]) + Data(repeating: 0, count: 32)))

        let key = try PersistedDeviceKeyStore(store: values).loadOrCreate()

        #expect(key.publicKeyUncompressed.count == 65)
    }

    @Test("recovery mints once, then settles")
    func regeneratesOnlyOnce() throws {
        let values = seeded("!!! not base64url !!!")
        let store = PersistedDeviceKeyStore(store: values)

        let recovered = try store.loadOrCreate()
        let again = try store.loadOrCreate()

        #expect(recovered.publicKeyUncompressed == again.publicKeyUncompressed)
    }

    @Test("delete forces the next read to mint")
    func deleteForcesAFreshMint() throws {
        let values = seeded(nil)
        let store = PersistedDeviceKeyStore(store: values)

        let first = try store.loadOrCreate()
        store.delete()
        let second = try store.loadOrCreate()

        #expect(first.publicKeyUncompressed != second.publicKeyUncompressed)
    }

    /// An unreadable store reads as empty, so minting would replace a healthy, merely locked id.
    @Test("refuses to mint over a store it cannot read")
    func refusesToMintOverAnUnreadableStore() throws {
        let values = InMemoryKeyValueStore(readable: false)
        let store = PersistedDeviceKeyStore(store: values)

        #expect(throws: (any Error).self) { try store.loadOrCreate() }
        #expect(values.string(forKey: PersistedDeviceKeyStore.storageKey) == nil)
    }

}
