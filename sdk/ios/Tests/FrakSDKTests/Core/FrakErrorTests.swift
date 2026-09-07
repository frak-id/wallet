import Foundation
import Testing

@testable import FrakSDK

@Suite("FrakError")
struct FrakErrorTests {
    private static let allErrors: [FrakError] = [
        .notInitialized,
        .network(underlying: URLError(.notConnectedToInternet)),
        .backingOff(retryAfterSeconds: 1.5),
        .server(status: 500, code: nil, retryAfterSeconds: nil),
        .decoding(message: "bad body"),
        .trackingDisabled,
        .merchantResolutionFailed(reason: "no merchant"),
        .alreadyPresenting,
        .internalFailure(message: "boom"),
    ]

    @Test("every case maps to its own kind, and every kind is reachable")
    func kindsAreTotalAndDistinct() {
        let kinds = Self.allErrors.map(\.kind)
        #expect(Set(kinds).count == kinds.count)
        #expect(Set(kinds) == Set(FrakError.Kind.allCases))
    }

    /// Spelled out, not derived: nothing but this test and its Kotlin twin keeps the two in step.
    @Test("kind raw values are the strings Android also emits")
    func rawValuesMatchAndroid() {
        #expect(FrakError.Kind.notInitialized.rawValue == "notInitialized")
        #expect(FrakError.Kind.network.rawValue == "network")
        #expect(FrakError.Kind.backingOff.rawValue == "backingOff")
        #expect(FrakError.Kind.server.rawValue == "server")
        #expect(FrakError.Kind.decoding.rawValue == "decoding")
        #expect(FrakError.Kind.trackingDisabled.rawValue == "trackingDisabled")
        #expect(FrakError.Kind.alreadyPresenting.rawValue == "alreadyPresenting")
        #expect(FrakError.Kind.merchantResolutionFailed.rawValue == "merchantResolutionFailed")
        #expect(FrakError.Kind.internalFailure.rawValue == "internalFailure")
    }

    @Test("every case carries a description")
    func everyCaseDescribesItself() {
        for error in Self.allErrors {
            #expect(error.errorDescription?.isEmpty == false, "\(error.kind) has no description")
        }
    }
}
