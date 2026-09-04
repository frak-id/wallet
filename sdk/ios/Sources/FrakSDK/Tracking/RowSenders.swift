import Foundation

/// The one place every `QueuedRow.kind` is registered to its `RowSender` — production and tests
/// must share this, or a forgotten kind silently skips rows in one but not the other.
enum RowSenders {
    static func `default`(logger: FrakLogger) -> [String: any RowSender] {
        [
            InteractionSender.kind: InteractionSender(logger: logger),
            PurchaseSender.kind: PurchaseSender(),
            MergeSender.kind: MergeSender(logger: logger),
        ]
    }
}
