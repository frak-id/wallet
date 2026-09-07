import Foundation

/// Delivers one row's kind: owns its URL, body, headers and response classification. The drain
/// looks one up by `QueuedRow.kind` and never interprets a row itself.
protocol RowSender: Sendable {
    func deliver(row: QueuedRow, ctx: SendContext) async throws(CancellationError) -> DeliveryOutcome
    /// How long a row may sit in `.hold` before the drain gives up on it.
    var holdTimeout: TimeInterval { get }
}

extension RowSender {
    /// A day is long enough for a cold-started merchant config to resolve.
    var holdTimeout: TimeInterval { 24 * 60 * 60 }

    /// Carries the id the row was captured under, not the current one. Shared by every sender
    /// that posts on behalf of a device.
    func clientIdHeaders(_ row: QueuedRow) -> [String: String] {
        row.clientId.map { ["x-frak-client-id": $0] } ?? [:]
    }

    /// The retry/reject boundary, in one place for every sender: 429 and 5xx ask for later,
    /// anything else non-2xx is a verdict. The single copy is the whole point — three copies is
    /// one drift away from a kind that spends its failure cap on an outage.
    func classify(_ response: HTTPClient.Response) -> DeliveryOutcome {
        if response.isSuccess { return .delivered }
        if response.status == 429 || response.status >= 500 { return .retryable(response.toServerError()) }
        return .rejected
    }
}
