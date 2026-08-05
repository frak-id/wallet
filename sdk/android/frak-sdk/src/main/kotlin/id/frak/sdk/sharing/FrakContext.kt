package id.frak.sdk.sharing

/**
 * Referral context carried in a share link's `fCtx`: who shared, for which merchant, and when.
 * Two layouts live on the wire with genuinely different information, hence sealed rather than
 * nullable fields on one type.
 *
 * A read model, not an input: the SDK decodes one from an inbound link and hands it back from
 * [id.frak.sdk.Frak.parseReferralLink]. So the constructors are `internal` and take no default
 * arguments — no Builder, for the same reason the resolved-config tree has none (see the note at the
 * top of `config/FrakResolvedConfig.kt`). Not `data class`es either: a published
 * `copy()`/`componentN()` could never be removed.
 */
public sealed interface FrakContext {
    /** Legacy layout: bare wallet address from pre-anonymous-id web builds. Decoded, never minted. */
    public class V1 internal constructor(
        public val wallet: String,
    ) : FrakContext {
        override fun equals(other: Any?): Boolean = other is V1 && other.wallet == wallet

        override fun hashCode(): Int = wallet.hashCode()

        override fun toString(): String = "FrakContext.V1(wallet=$wallet)"
    }

    /** Current layout. Carries the merchant, a share timestamp, and at least one of [clientId] / [wallet]. */
    public class V2 internal constructor(
        public val merchantId: String,
        public val timestamp: Long,
        public val clientId: String?,
        public val wallet: String?,
    ) : FrakContext {
        override fun equals(other: Any?): Boolean =
            other is V2 &&
                other.merchantId == merchantId &&
                other.timestamp == timestamp &&
                other.clientId == clientId &&
                other.wallet == wallet

        override fun hashCode(): Int {
            var result = merchantId.hashCode()
            result = 31 * result + timestamp.hashCode()
            result = 31 * result + (clientId?.hashCode() ?: 0)
            result = 31 * result + (wallet?.hashCode() ?: 0)
            return result
        }

        override fun toString(): String =
            "FrakContext.V2(merchantId=$merchantId, timestamp=$timestamp, clientId=$clientId, wallet=$wallet)"
    }
}
