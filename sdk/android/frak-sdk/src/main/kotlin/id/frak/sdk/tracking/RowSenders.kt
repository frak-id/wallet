package id.frak.sdk.tracking

import id.frak.sdk.core.FrakLogger

/** The one place every [QueuedRow.kind] is registered to its [RowSender] — production and tests must share this, or a forgotten kind silently skips rows in one but not the other. */
internal object RowSenders {
    fun default(logger: FrakLogger): Map<String, RowSender> =
        mapOf(
            InteractionSender.KIND to InteractionSender(logger),
            PurchaseSender.KIND to PurchaseSender(),
            MergeSender.KIND to MergeSender(logger),
        )
}
