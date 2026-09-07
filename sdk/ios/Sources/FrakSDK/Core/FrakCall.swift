import Foundation

// Normalises whatever escapes so only FrakError or CancellationError leave the SDK's
// public entry points. CancellationError rethrown untouched (never swallowed).
func frakCall<T: Sendable>(
    isolation: isolated (any Actor)? = #isolation,
    _ body: () async throws -> T
) async throws -> T {
    do {
        return try await body()
    } catch is CancellationError {
        throw CancellationError()
    } catch let error as FrakError {
        throw error
    } catch {
        throw FrakError.internalFailure(message: "unexpected failure: \(error.localizedDescription)")
    }
}
