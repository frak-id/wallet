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
        let logger = FrakLogger(level: .none)
        return AnonymousIdStore(
            keyStore: keyStore,
            store: values,
            logger: logger,
            merchantMarker: merchantMarker,
            // Shares `values` with the identity store, as `Frak.initialize` wires it.
            consent: TrackingConsent(store: values, configDefault: trackingEnabled, logger: logger)
        )
    }

    @Test("derives a stable id and mints the key exactly once")
    func derivesAStableId() async {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore)

        let first = await store.anonymousId()
        let second = await store.anonymousId()

        #expect(first != nil)
        #expect(first == second)
        #expect(first?.count == 36)
        #expect(keyStore.creations == 1)
    }

    @Test("returns nil and touches no key material when tracking is disabled")
    func inertWhenTrackingIsDisabled() async {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore, trackingEnabled: false)

        #expect(await store.anonymousId() == nil)
        #expect(await store.signProof(.install, merchantId: Self.merchantId) == nil)
        #expect(keyStore.creations == 0)
    }

    @Test("returns nil rather than an unprovable id when the platform refuses")
    func nilWhenThePlatformRefuses() async {
        let store = makeStore(keyStore: FakeDeviceKeyStore(failOnCreate: true))

        #expect(await store.anonymousId() == nil)
        #expect(await store.signProof(.install, merchantId: Self.merchantId) == nil)
    }

    @Test("a keystore that recovers gets an id, without a restart")
    func recoversAfterATransientRefusal() async {
        let keyStore = FakeDeviceKeyStore(failOnCreate: true)
        let store = makeStore(keyStore: keyStore)
        #expect(await store.anonymousId() == nil)

        keyStore.failOnCreate = false

        #expect(await store.anonymousId() != nil)
    }

    @Test("does not cache a transient refusal, and the eventual mint is still memoised")
    func doesNotCacheATransientRefusal() async {
        let keyStore = FakeDeviceKeyStore(failOnCreate: true)
        let store = makeStore(keyStore: keyStore)

        #expect(await store.anonymousId() == nil)
        #expect(await store.anonymousId() == nil)
        #expect(keyStore.creations == 0)

        keyStore.failOnCreate = false

        let first = await store.anonymousId()
        let second = await store.anonymousId()

        #expect(first != nil)
        #expect(first == second)
        #expect(keyStore.creations == 1)
    }

    @Test("reset mints a new identity")
    func resetMintsANewIdentity() async {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore)

        let before = await store.anonymousId()
        #expect(await store.reset())
        let after = await store.anonymousId()

        #expect(before != after)
        #expect(keyStore.creations == 2)
    }

    @Test("keeps the identity across restarts for the same merchant")
    func survivesARestart() async {
        let keyStore = FakeDeviceKeyStore()
        let values = InMemoryKeyValueStore()

        let before = await makeStore(keyStore: keyStore, values: values).anonymousId()
        let after = await makeStore(keyStore: keyStore, values: values).anonymousId()

        #expect(before == after)
        #expect(keyStore.creations == 1)
    }

    @Test("regenerates when the merchant changed under an existing install")
    func regeneratesOnMerchantChange() async {
        let keyStore = FakeDeviceKeyStore()
        let values = InMemoryKeyValueStore()

        let before = await makeStore(keyStore: keyStore, values: values).anonymousId()
        let after = await makeStore(keyStore: keyStore, values: values, merchantMarker: "other-merchant").anonymousId()

        #expect(before != after)
        #expect(keyStore.creations == 2)
    }

    @Test("signs a proof the id can be checked against")
    func signsACheckableProof() async throws {
        let store = makeStore(keyStore: FakeDeviceKeyStore())

        let proof = try #require(await store.signProof(.install, merchantId: Self.merchantId, ts: 1_700_000_000))
        // 138 raw bytes — version, key, timestamp, signature — base64url without padding.
        #expect(proof.count == 184)

        let envelope = try #require(Base64URL.decode(proof))
        #expect(envelope.count == 138)
        #expect(envelope.first == ProofCodec.envelopeVersion)
    }

    @Test("refuses to sign for a merchant id that is not a uuid")
    func refusesToSignForANonUUIDMerchant() async {
        let store = makeStore(keyStore: FakeDeviceKeyStore())
        #expect(await store.signProof(.install, merchantId: "not-a-uuid") == nil)
    }

    @Test("a caller racing eager generation shares it instead of minting a second identity")
    func racingEagerGenerationSharesTheSameTask() async {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore)

        async let eager: Void = store.startEagerGeneration()
        async let racer = store.anonymousId()

        _ = await eager
        // Hoisted out of `#expect`: an `async let` variable cannot be awaited inside the closure
        // the macro expands to.
        let racerId = await racer
        #expect(racerId != nil)
        #expect(keyStore.creations == 1)
    }

    // `Task.detached`'s `load()` does not cooperate with cancellation: `generation?.cancel()`
    // only flips `Task.isCancelled`, so `identity()` must check it after awaiting, not before.
    @Test("a caller racing reset never receives the identity reset is erasing", arguments: 0..<20)
    func racingResetNeverPublishesTheErasedIdentity(iteration: Int) async {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore)
        let original = await store.anonymousId()

        // The read above already installed a generation; this races a second caller against
        // reset() clearing that same generation.
        async let racer = store.anonymousId()
        async let resetOk = store.reset()

        let racerId = await racer
        let resetSucceeded = await resetOk
        #expect(resetSucceeded)

        let after = await store.anonymousId()
        if let racerId {
            #expect(racerId == original || racerId == after, "racer's id must be a real, live generation")
        }
        #expect(after != nil)
        #expect(after != original, "reset() must have rotated the identity by the time both sides finish")
    }
}
