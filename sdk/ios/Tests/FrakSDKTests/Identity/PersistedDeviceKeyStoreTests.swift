import Foundation
import Testing

@testable import FrakSDK

/// The real store, not a fake — the only executed coverage `PersistedDeviceKeyStore` has ever
/// had. Which backing `generate()` picks depends on the host (an Apple-silicon Mac reports a
/// Secure Enclave, an Intel one does not), so nothing here asserts on the backing.
///
/// What it cannot reach is the real §2.8 event: an enclave rejecting a blob wrapped by another
/// device's chip. The regression test below reproduces the *shape* that recovery hangs off —
/// stored material `restore` throws on — using the software branch, so it neither depends on an
/// enclave nor asserts Apple's specific error.
/// Whether this host can produce key material at all. An Apple-silicon Mac reports a Secure
/// Enclave, but an unsigned SPM test binary has no entitlement to use it, so `generate()` can
/// throw there for reasons that say nothing about the SDK. A visible skip beats a red suite — if
/// these show as skipped, that is the environment, not a regression.
///
/// Outside the suite type on purpose: `@Suite` is an attached member macro, so reading a static
/// off the type it decorates asks for a member table that the attribute itself has to be
/// resolved to build.
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

    /// The §2.8 restore scenario: material is present and this device cannot use it. Before the
    /// fix this threw, and threw again on every later call, so the install never had an id.
    ///
    /// Deliberately the software tag and a wrong-sized scalar rather than an enclave blob: the
    /// length check rejects it on any host, where an enclave blob would depend on hardware the
    /// test machine may not have. Same `restore` failure, same recovery branch.
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

    /// Recovery must be a one-off. If it re-minted on every call the id would change under
    /// the caller, which is the failure the old "never regenerate" comment was guarding against.
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
}
