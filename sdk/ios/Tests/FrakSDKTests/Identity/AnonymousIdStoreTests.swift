import Foundation
import Testing

@testable import FrakSDK

@Suite("AnonymousIdStore")
struct AnonymousIdStoreTests {
    private static let merchantId = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"

    private func makeStore(
        keyStore: FakeDeviceKeyStore,
        values: InMemoryKeyValueStore = InMemoryKeyValueStore(),
        merchantMarker: String = AnonymousIdStoreTests.merchantId,
        trackingEnabled: Bool = true
    ) -> AnonymousIdStore {
        AnonymousIdStore(
            keyStore: keyStore,
            store: values,
            logger: FrakLogger(level: .none),
            merchantMarker: merchantMarker,
            trackingEnabled: trackingEnabled
        )
    }

    @Test("derives a stable id and mints the key exactly once")
    func derivesAStableId() {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore)

        let first = store.anonymousId()
        let second = store.anonymousId()

        #expect(first != nil)
        #expect(first == second)
        #expect(first?.count == 36)
        #expect(keyStore.creations == 1)
    }

    @Test("returns nil and touches no key material when tracking is disabled")
    func inertWhenTrackingIsDisabled() {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore, trackingEnabled: false)

        #expect(store.anonymousId() == nil)
        #expect(store.signProof(.ensure, merchantId: Self.merchantId) == nil)
        #expect(keyStore.creations == 0)
    }

    @Test("returns nil rather than an unprovable id when the platform refuses")
    func nilWhenThePlatformRefuses() {
        let store = makeStore(keyStore: FakeDeviceKeyStore(failOnCreate: true))

        #expect(store.anonymousId() == nil)
        #expect(store.signProof(.ensure, merchantId: Self.merchantId) == nil)
    }

    @Test("reset mints a new identity")
    func resetMintsANewIdentity() {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore)

        let before = store.anonymousId()
        store.reset()
        let after = store.anonymousId()

        #expect(before != after)
        #expect(keyStore.creations == 2)
    }

    @Test("keeps the identity across restarts for the same merchant")
    func survivesARestart() {
        let keyStore = FakeDeviceKeyStore()
        let values = InMemoryKeyValueStore()

        let before = makeStore(keyStore: keyStore, values: values).anonymousId()
        let after = makeStore(keyStore: keyStore, values: values).anonymousId()

        #expect(before == after)
        #expect(keyStore.creations == 1)
    }

    @Test("regenerates when the merchant changed under an existing install")
    func regeneratesOnMerchantChange() {
        let keyStore = FakeDeviceKeyStore()
        let values = InMemoryKeyValueStore()

        let before = makeStore(keyStore: keyStore, values: values).anonymousId()
        let after = makeStore(keyStore: keyStore, values: values, merchantMarker: "other-merchant").anonymousId()

        #expect(before != after)
        #expect(keyStore.creations == 2)
    }

    @Test("signs a proof the id can be checked against")
    func signsACheckableProof() throws {
        let store = makeStore(keyStore: FakeDeviceKeyStore())

        let proof = try #require(store.signProof(.ensure, merchantId: Self.merchantId, ts: 1_700_000_000))
        // 138 raw bytes — version, key, timestamp, signature — base64url without padding.
        #expect(proof.count == 184)

        let envelope = try #require(Base64URL.decode(proof))
        #expect(envelope.count == 138)
        #expect(envelope.first == ProofCodec.envelopeVersion)
    }

    @Test("refuses to sign for a merchant id that is not a uuid")
    func refusesToSignForANonUUIDMerchant() {
        let store = makeStore(keyStore: FakeDeviceKeyStore())
        #expect(store.signProof(.ensure, merchantId: "not-a-uuid") == nil)
    }
}
