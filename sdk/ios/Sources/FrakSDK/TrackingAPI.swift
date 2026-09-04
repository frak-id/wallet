import Foundation

/// Interaction and purchase tracking. Obtained from `FrakClient.tracking`.
public struct TrackingAPI: Sendable {
    let core: DefaultFrakClient

    /// Succeeds once durable, not once delivered.
    @discardableResult
    public func track(_ interaction: Interaction) async -> Result<Void, FrakError> {
        await core.track(interaction)
    }

    @discardableResult
    public func purchase(customerId: String, orderId: String, token: String) async -> Result<Void, FrakError> {
        await core.trackPurchase(customerId: customerId, orderId: orderId, token: token)
    }
}
