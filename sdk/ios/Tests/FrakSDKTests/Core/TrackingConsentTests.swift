import Foundation
import Testing

@testable import FrakSDK

/// S6a/C7. The tri-state table in `TrackingConsent`'s doc comment, one test per row plus the two
/// behaviours that are easy to "simplify" away later: the compile-time floor, and the fact that an
/// absent key follows the config rather than reading as a denial.
///
/// Kept in step with its Android twin, `TrackingConsentTest.kt` — same rows, same names where the
/// language allows.
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

        // A second instance over the same store is the next app launch: nothing is carried over in
        // memory, so this reads only what was written.
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

    /// The hard floor. Pinned because the obvious "simplification" — letting the persisted value
    /// win outright — silently turns the SDK on inside a merchant's staged-rollout build, which is
    /// the one outcome this type exists to make impossible.
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

    /// An unreadable or half-written value is not a denial. Failing towards "off" here would turn
    /// one corrupt suite into an install that never tracks again and never says why — the same
    /// reasoning as `AnonymousIdStore`'s refusal ever to cache a keystore failure.
    @Test("an unrecognised stored value follows the config rather than reading as a denial")
    func unrecognisedValueFollowsTheConfig() async {
        let store = InMemoryKeyValueStore()
        store.set("\u{0000}garbage", forKey: "tracking-consent")

        #expect(await consent(store: store, configDefault: true).isEnabled())
        #expect(await consent(store: store, configDefault: false).isEnabled() == false)
    }
}
