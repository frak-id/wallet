package id.frak.sdk.rewards

import id.frak.sdk.core.FrakError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Pins the decode of `GET /user/merchant/estimated-rewards`. */
class RewardsDecoderTest {
    @Test
    fun `decodes a fixed reward`() {
        val result = RewardsDecoder.decode(FIXED_RESPONSE)

        assertEquals(1, result.campaigns.size)
        val campaign = result.campaigns.first()
        assertEquals("Summer", campaign.name)
        assertEquals("purchase", campaign.interactionTypeKey)

        val referrer = campaign.referrer
        assertTrue("expected Fixed, got $referrer", referrer is EstimatedReward.Fixed)
        assertEquals(10.0, (referrer as EstimatedReward.Fixed).amount.eurAmount, 0.0)
    }

    @Test
    fun `decodes a percentage reward with optional bounds`() {
        val referrer =
            RewardsDecoder
                .decode(PERCENTAGE_RESPONSE)
                .campaigns
                .first()
                .referrer

        assertTrue("expected Percentage, got $referrer", referrer is EstimatedReward.Percentage)
        referrer as EstimatedReward.Percentage
        assertEquals(5.0, referrer.percent, 0.0)
        assertEquals("purchase_amount", referrer.percentOf)
        assertEquals(50.0, referrer.maxAmount?.eurAmount)
        // Absent bounds stay absent rather than becoming zero — a zero maximum
        // would silently cap every reward at nothing.
        assertNull(referrer.minAmount)
    }

    @Test
    fun `decodes tiered rewards, discriminating tiers on the presence of percent`() {
        val referrer =
            RewardsDecoder
                .decode(TIERED_RESPONSE)
                .campaigns
                .first()
                .referrer

        assertTrue("expected Tiered, got $referrer", referrer is EstimatedReward.Tiered)
        referrer as EstimatedReward.Tiered
        assertEquals(2, referrer.tiers.size)
        assertTrue("first tier is an amount", referrer.tiers[0] is RewardTier.Amount)
        assertTrue("second tier is a percentage", referrer.tiers[1] is RewardTier.Percentage)
        // An open-ended top tier omits maxValue rather than sending a sentinel.
        assertNull(referrer.tiers[1].maxValue)
    }

    @Test
    fun `an unknown payout type degrades to Unknown rather than dropping the campaign`() {
        val body =
            """
            {"rewards":[{"campaignId":"c","name":"New","interactionTypeKey":"purchase",
             "conditions":[],"referrer":{"payoutType":"quantum","somethingNew":1}}]}
            """.trimIndent()

        val referrer =
            RewardsDecoder
                .decode(body)
                .campaigns
                .first()
                .referrer

        // Dropping it would make a newly-launched reward type look, to a frozen
        // binary, exactly like a merchant with nothing configured.
        assertTrue("expected Unknown, got $referrer", referrer is EstimatedReward.Unknown)
        assertEquals("quantum", (referrer as EstimatedReward.Unknown).payoutType)
    }

    @Test
    fun `a missing payoutType is a decoding error`() {
        val body =
            """{"rewards":[{"campaignId":"c","name":"N","interactionTypeKey":"purchase",
             "conditions":[],"referrer":{"somethingNew":1}}]}"""

        val failure = runCatching { RewardsDecoder.decode(body) }.exceptionOrNull()

        // Absent entirely is a contract break, unlike a present-but-unrecognised
        // value (which degrades to Unknown, see the test above).
        assertTrue("expected Decoding, got $failure", failure is FrakError.Decoding)
        assertTrue(
            "the message should name payoutType, was: ${failure?.message}",
            failure?.message?.contains("payoutType") == true,
        )
    }

    @Test
    fun `an empty rewards array decodes to an empty list, not an error`() {
        // This endpoint NEVER 404s: an unknown merchantId returns exactly this.
        // It is indistinguishable from a real merchant between campaigns, which
        // is why the diagnosis lives on resolveConfig().
        val result = RewardsDecoder.decode("""{"rewards":[]}""")

        assertTrue(result.campaigns.isEmpty())
        assertNull(result.best)
    }

    @Test
    fun `best is absent when the server did not select one`() {
        // `best` is attached only when formatted=1 AND a campaign was selected.
        // It is omitted, never null and never an empty object.
        assertNull(RewardsDecoder.decode(FIXED_RESPONSE).best)
    }

    @Test
    fun `best preserves the non-breaking space before the currency symbol`() {
        val best = requireNotNull(RewardsDecoder.decode(FORMATTED_RESPONSE).best)

        // U+00A0, not U+0020. The two are visually identical and compare
        // unequal, so any code testing `formatted == "12 €"` typed with an
        // ordinary space silently never matches.
        assertEquals("12\u00a0€", best.formatted)
        assertEquals(
            "the separator must be U+00A0",
            '\u00a0',
            best.formatted[best.formatted.length - 2],
        )
    }

    @Test
    fun `best decodes its optional display fields`() {
        val best = requireNotNull(RewardsDecoder.decode(FORMATTED_RESPONSE).best)

        assertEquals("fixed", best.payoutType)
        // Pre-formatted by the server, alongside the raw value for callers doing
        // their own comparisons.
        assertEquals("10\u00a0€", best.minPurchaseAmount)
        assertEquals(10.0, best.minPurchaseValue)
        assertEquals(7.0, best.lockupDurationDays)
    }

    @Test
    fun `a non-expiring campaign decodes expiresAt as null`() {
        // The backend sends an explicit JSON null here rather than omitting it.
        assertNull(
            RewardsDecoder
                .decode(FIXED_RESPONSE)
                .campaigns
                .first()
                .expiresAt,
        )
    }

    @Test
    fun `a missing required field is a decoding error`() {
        val body = """{"rewards":[{"name":"Summer","interactionTypeKey":"purchase","conditions":[]}]}"""

        val failure = runCatching { RewardsDecoder.decode(body) }.exceptionOrNull()

        assertTrue("expected Decoding, got $failure", failure is FrakError.Decoding)
        assertTrue(
            "the message should name campaignId, was: ${failure?.message}",
            failure?.message?.contains("campaignId") == true,
        )
    }

    @Test
    fun `zero fiat amounts are preserved rather than treated as absent`() {
        val body =
            """
            {"rewards":[{"campaignId":"c","name":"N","interactionTypeKey":"purchase","conditions":[],
             "referrer":{"payoutType":"fixed","amount":{"amount":100,"eurAmount":0,"usdAmount":0,"gbpAmount":0}}}]}
            """.trimIndent()

        val fixed =
            RewardsDecoder
                .decode(body)
                .campaigns
                .first()
                .referrer as EstimatedReward.Fixed

        // Zero fiat means "price unavailable", not "worth nothing" — the raw
        // token amount is non-zero. A decoder that dropped the zeros would hide
        // the distinction the caller needs to make.
        assertEquals(0.0, fixed.amount.eurAmount, 0.0)
        assertEquals(100.0, fixed.amount.amount, 0.0)
    }

    private companion object {
        val FIXED_RESPONSE =
            """
            {"rewards":[{
              "campaignId":"c1","name":"Summer","interactionTypeKey":"purchase","conditions":[],
              "expiresAt":null,
              "referrer":{"payoutType":"fixed",
                "amount":{"amount":1000,"eurAmount":10,"usdAmount":11,"gbpAmount":9}}
            }]}
            """.trimIndent()

        val PERCENTAGE_RESPONSE =
            """
            {"rewards":[{
              "campaignId":"c1","name":"Summer","interactionTypeKey":"purchase","conditions":[],
              "referrer":{"payoutType":"percentage","percent":5,"percentOf":"purchase_amount",
                "maxAmount":{"amount":5000,"eurAmount":50,"usdAmount":55,"gbpAmount":45}}
            }]}
            """.trimIndent()

        val TIERED_RESPONSE =
            """
            {"rewards":[{
              "campaignId":"c1","name":"Summer","interactionTypeKey":"purchase","conditions":[],
              "referrer":{"payoutType":"tiered","tierField":"purchase_amount","tiers":[
                {"minValue":0,"maxValue":100,
                 "amount":{"amount":100,"eurAmount":1,"usdAmount":1,"gbpAmount":1}},
                {"minValue":100,"percent":5}
              ]}
            }]}
            """.trimIndent()

        val FORMATTED_RESPONSE =
            """
            {"rewards":[],"best":{
              "formatted":"12\u00a0€","payoutType":"fixed",
              "minPurchaseAmount":"10\u00a0€","minPurchaseValue":10,"lockupDurationDays":7
            }}
            """.trimIndent()
    }
}
