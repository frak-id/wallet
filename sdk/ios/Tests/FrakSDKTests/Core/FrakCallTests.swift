import Foundation
import Testing

@testable import FrakSDK

@Suite("frakCall")
struct FrakCallTests {
    @Test("a value returned by body passes through unchanged")
    func returnsValue() async throws {
        let result = try await frakCall { 7 }
        #expect(result == 7)
    }

    @Test("a FrakError thrown by body passes through unchanged")
    func frakErrorPassesThrough() async throws {
        do {
            _ = try await frakCall { () -> Int in throw FrakError.trackingDisabled }
            Issue.record("expected trackingDisabled to be thrown")
        } catch FrakError.trackingDisabled {
        }
    }

    @Test("a CancellationError thrown by body is rethrown untouched")
    func cancellationPassesThrough() async throws {
        await #expect(throws: CancellationError.self) {
            _ = try await frakCall { () -> Int in throw CancellationError() }
        }
    }

    @Test("an unexpected error thrown by body is normalised to FrakError.internalFailure")
    func unexpectedErrorIsNormalised() async throws {
        struct Boom: Error {}

        var thrown: FrakError?
        do {
            _ = try await frakCall { () -> Int in throw Boom() }
        } catch let error as FrakError {
            thrown = error
        }
        #expect(try #require(thrown).kind == .internalFailure)
    }
}
