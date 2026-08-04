import Foundation
import Testing

@testable import FrakSDK

/// One test per row of `TrackingConsent`'s tri-state table, plus the compile-time floor and the
/// fact that an absent key follows the config rather than reading as a denial.
@Suite("TrackingConsent")
struct TrackingConsentTests {
    private func consent(
        store: InMemoryKeyValueStore = InMemoryKeyValueStore(),
        configDefault: Bool = true
    ) -> TrackingConsent {
        TrackingConsent(store: store, configDefault: configDefault, logger: FrakLogger(level: .none))
    }

    @Test("an absent decision follows the config, so an integration written before consent is unchanged")
    func absentDecisionFollowsTheConfig() async {
        #expect(await consent(configDefault: true).isEnabled())
        #expect(await consent(configDefault: false).isEnabled() == false)
    }

    @Test("a denial survives the process that recorded it")
    func denialIsPersisted() async {
        let store = InMemoryKeyValueStore()
        await consent(store: store).setEnabled(false)

        // A second instance over the same store is the next app launch: nothing carries over in memory.
        #expect(await consent(store: store).isEnabled() == false)
    }

    @Test("a grant recorded after a denial re-enables tracking")
    func grantAfterDenialReEnables() async {
        let store = InMemoryKeyValueStore()
        let subject = consent(store: store)

        await subject.setEnabled(false)
        #expect(await subject.isEnabled() == false)
        await subject.setEnabled(true)

        #expect(await subject.isEnabled())
        #expect(await consent(store: store).isEnabled())
    }

    /// The hard floor: letting the persisted value win outright would silently turn the SDK on
    /// inside a merchant's staged-rollout build.
    @Test("a persisted grant can never lift a compile-time trackingEnabled: false")
    func compileTimeDisableIsAHardFloor() async {
        let store = InMemoryKeyValueStore()
        let subject = consent(store: store, configDefault: false)

        await subject.setEnabled(true)

        #expect(await subject.isEnabled() == false)
        // Recorded even so: the merchant's users really did consent, and a build that later ships
        // trackingEnabled: true must honour that rather than re-prompt.
        #expect(await consent(store: store, configDefault: true).isEnabled())
    }

    @Test("the decision is written to the identity suite under one stable key")
    func decisionUsesOneStableKey() async {
        let store = InMemoryKeyValueStore()

        #expect(store.string(forKey: "tracking-consent") == nil)
        await consent(store: store).setEnabled(false)
        #expect(store.string(forKey: "tracking-consent") == "denied")
        await consent(store: store).setEnabled(true)
        #expect(store.string(forKey: "tracking-consent") == "granted")
    }

    /// An unreadable or half-written value is not a denial: failing towards "off" would turn one
    /// corrupt suite into an install that never tracks again and never says why.
    @Test("an unrecognised stored value follows the config rather than reading as a denial")
    func unrecognisedValueFollowsTheConfig() async {
        let store = InMemoryKeyValueStore()
        store.set("\u{0000}garbage", forKey: "tracking-consent")

        #expect(await consent(store: store, configDefault: true).isEnabled())
        #expect(await consent(store: store, configDefault: false).isEnabled() == false)
    }
}
