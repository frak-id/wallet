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
        #expect(await store.signProof(.ensure, merchantId: Self.merchantId) == nil)
        #expect(keyStore.creations == 0)
    }

    @Test("returns nil rather than an unprovable id when the platform refuses")
    func nilWhenThePlatformRefuses() async {
        let store = makeStore(keyStore: FakeDeviceKeyStore(failOnCreate: true))

        #expect(await store.anonymousId() == nil)
        #expect(await store.signProof(.ensure, merchantId: Self.merchantId) == nil)
    }

    /// Pins the decision not to cache the failure. A keystore can refuse for reasons that pass:
    /// key operations are unavailable before the device's first unlock, so an app launched by a
    /// push on a rebooted phone would otherwise be stuck inert until the user force-quit it.
    @Test("a keystore that recovers gets an id, without a restart")
    func recoversAfterATransientRefusal() async {
        let keyStore = FakeDeviceKeyStore(failOnCreate: true)
        let store = makeStore(keyStore: keyStore)
        #expect(await store.anonymousId() == nil)

        keyStore.failOnCreate = false

        #expect(await store.anonymousId() != nil)
    }

    /// A refusal is a `Task` too, and 4.5's whole point is that a `Task` is memoised. This pins
    /// that the memoisation is conditional on success: a recovered mint is cached exactly once
    /// (one `keyStore.creations`), and the earlier failed attempt cost zero extra key
    /// generations — it is dropped, not retried in a loop, and not left occupying the slot.
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

        let proof = try #require(await store.signProof(.ensure, merchantId: Self.merchantId, ts: 1_700_000_000))
        // 138 raw bytes — version, key, timestamp, signature — base64url without padding.
        #expect(proof.count == 184)

        let envelope = try #require(Base64URL.decode(proof))
        #expect(envelope.count == 138)
        #expect(envelope.first == ProofCodec.envelopeVersion)
    }

    @Test("refuses to sign for a merchant id that is not a uuid")
    func refusesToSignForANonUUIDMerchant() async {
        let store = makeStore(keyStore: FakeDeviceKeyStore())
        #expect(await store.signProof(.ensure, merchantId: "not-a-uuid") == nil)
    }

    /// 4.5: two callers racing `anonymousId()` — one via `startEagerGeneration`, one calling
    /// directly — must await the SAME in-flight generation rather than each independently
    /// re-entering `FakeDeviceKeyStore.loadOrCreate`. Two key generations here would mean the
    /// single-flight guard failed and a racing caller re-minted a second identity.
    @Test("a caller racing eager generation shares it instead of minting a second identity")
    func racingEagerGenerationSharesTheSameTask() async {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore)

        async let eager: Void = store.startEagerGeneration()
        async let racer = store.anonymousId()

        _ = await eager
        // Hoisted out of `#expect`: an `async let` variable cannot be awaited inside the closure
        // the macro expands to (see SingleFlightTests.swift's note on the same restriction).
        let racerId = await racer
        #expect(racerId != nil)
        #expect(keyStore.creations == 1)
    }

    // 4fp / erasure-path race: a caller already suspended on the in-flight generation when
    // `reset()` runs must never receive the identity `reset()` is in the middle of erasing.
    // `Task.detached`'s `load()` is synchronous non-cooperative code, so `generation?.cancel()`
    // cannot actually stop it mid-flight the way `Deferred.cancel()` does on the Android twin —
    // it only flips `Task.isCancelled`, which `identity()` must check AFTER awaiting, not before,
    // to catch a `reset()` that lands while the await is suspended. `async let` gives both sides
    // a genuine chance to interleave through the cooperative pool without an artificial delay
    // hook that `FakeDeviceKeyStore` does not have; it cannot force the exact interleaving
    // deterministically, but any interleaving it does produce must satisfy the invariant below.
    @Test("a caller racing reset never receives the identity reset is erasing", arguments: 0..<20)
    func racingResetNeverPublishesTheErasedIdentity(iteration: Int) async {
        let keyStore = FakeDeviceKeyStore()
        let store = makeStore(keyStore: keyStore)
        let original = await store.anonymousId()

        // A fresh generation is already installed by the read above, so this races the SECOND
        // caller against reset() clearing that same in-flight-or-completed generation.
        async let racer = store.anonymousId()
        async let resetOk = store.reset()

        let racerId = await racer
        let resetSucceeded = await resetOk
        #expect(resetSucceeded)

        // The racer is allowed to see the ORIGINAL id (reset() had not yet cleared the memo when
        // it read) or a brand new one (reset() ran first) — both are legitimate outcomes of an
        // honest race. What must never happen: reset() reports success while the racer's answer
        // is an identity that is neither the original nor the store's post-reset steady state,
        // which would mean it received a value load() computed but reset() had already erased.
        let after = await store.anonymousId()
        if let racerId {
            #expect(racerId == original || racerId == after, "racer's id must be a real, live generation")
        }
        #expect(after != nil)
        #expect(after != original, "reset() must have rotated the identity by the time both sides finish")
    }
}
