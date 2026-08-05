import Foundation
import Testing

@testable import FrakSDK

@Suite("UserDefaultsStore")
struct UserDefaultsStoreTests {
    @Test("round-trips a value through get, put, and remove")
    func roundTripsAValue() throws {
        let store = try #require(UserDefaultsStore(suiteName: "id.frak.sdk.tests.\(UUID().uuidString)"))

        #expect(store.string(forKey: "k") == nil)
        store.set("v", forKey: "k")
        #expect(store.string(forKey: "k") == "v")
        store.removeValue(forKey: "k")
        #expect(store.string(forKey: "k") == nil)
    }
}
