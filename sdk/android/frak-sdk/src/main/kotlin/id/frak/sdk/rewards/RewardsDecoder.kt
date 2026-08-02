package id.frak.sdk.rewards

import id.frak.sdk.net.JsonReader
import org.json.JSONObject

/** The decoded `GET /user/merchant/estimated-rewards` body. */
internal class EstimatedRewardsResult(
    val campaigns: List<Campaign>,
    /** Present only when `?formatted=1` was sent **and** a campaign was selected. */
    val best: BestReward?,
)

/**
 * Turns a `GET /user/merchant/estimated-rewards` body into typed models.
 *
 * `conditions`/`productScope` (the recursive `RuleConditions` tree) are not
 * decoded: nothing reads them yet, and decoding it safely needs a depth cap
 * chosen by the eventual consumer, not by this decoder.
 */
internal object RewardsDecoder {
    private const val CONTEXT = "merchant/estimated-rewards response"

    fun decode(body: String): EstimatedRewardsResult {
        val root = JsonReader.parseObject(body)
        return EstimatedRewardsResult(
            campaigns = JsonReader.objectArray(root, "rewards", ::decodeCampaign),
            best = JsonReader.obj(root, "best")?.let(::decodeBest),
        )
    }

    private fun decodeCampaign(source: JSONObject): Campaign =
        Campaign(
            campaignId = JsonReader.requireString(source, "campaignId", CONTEXT),
            name = JsonReader.requireString(source, "name", CONTEXT),
            interactionTypeKey = JsonReader.requireString(source, "interactionTypeKey", CONTEXT),
            referrer = JsonReader.obj(source, "referrer")?.let(::decodeReward),
            referee = JsonReader.obj(source, "referee")?.let(::decodeReward),
            defaultLockupSeconds = JsonReader.double(source, "defaultLockupSeconds"),
            maxRewardsPerUser = JsonReader.double(source, "maxRewardsPerUser"),
            // Explicit JSON null and absent both mean "no expiry" here.
            expiresAt = JsonReader.string(source, "expiresAt"),
        )

    // An unrecognised payoutType becomes Unknown rather than an error or a
    // dropped campaign; a genuinely missing payoutType is a contract break,
    // same as any other missing required field, so it throws via requireString.
    private fun decodeReward(source: JSONObject): EstimatedReward {
        val payoutType = JsonReader.requireString(source, "payoutType", CONTEXT)
        return when (payoutType) {
            "fixed" -> {
                EstimatedReward.Fixed(
                    amount = decodeTokenAmount(JsonReader.requireObject(source, "amount", CONTEXT)),
                )
            }

            "percentage" -> {
                EstimatedReward.Percentage(
                    percent = JsonReader.requireDouble(source, "percent", CONTEXT),
                    percentOf = JsonReader.requireString(source, "percentOf", CONTEXT),
                    maxAmount = JsonReader.obj(source, "maxAmount")?.let(::decodeTokenAmount),
                    minAmount = JsonReader.obj(source, "minAmount")?.let(::decodeTokenAmount),
                )
            }

            "tiered" -> {
                EstimatedReward.Tiered(
                    tierField = JsonReader.requireString(source, "tierField", CONTEXT),
                    tiers = JsonReader.objectArray(source, "tiers", ::decodeTier),
                )
            }

            else -> {
                EstimatedReward.Unknown(payoutType)
            }
        }
    }

    // No discriminator field on a tier; presence of `percent` is the
    // discriminator, matching the producer.
    private fun decodeTier(source: JSONObject): RewardTier {
        val minValue = JsonReader.requireDouble(source, "minValue", CONTEXT)
        val maxValue = JsonReader.double(source, "maxValue")
        val percent = JsonReader.double(source, "percent")
        percent?.let { return RewardTier.Percentage(minValue, maxValue, it) }

        val amount = decodeTokenAmount(JsonReader.requireObject(source, "amount", CONTEXT))
        return RewardTier.Amount(minValue, maxValue, amount)
    }

    private fun decodeTokenAmount(source: JSONObject): TokenAmount =
        TokenAmount(
            amount = JsonReader.requireDouble(source, "amount", CONTEXT),
            eurAmount = JsonReader.requireDouble(source, "eurAmount", CONTEXT),
            usdAmount = JsonReader.requireDouble(source, "usdAmount", CONTEXT),
            gbpAmount = JsonReader.requireDouble(source, "gbpAmount", CONTEXT),
        )

    private fun decodeBest(source: JSONObject): BestReward =
        BestReward(
            formatted = JsonReader.requireString(source, "formatted", CONTEXT),
            payoutType = JsonReader.requireString(source, "payoutType", CONTEXT),
            minPurchaseAmount = JsonReader.string(source, "minPurchaseAmount"),
            minPurchaseValue = JsonReader.double(source, "minPurchaseValue"),
            lockupDurationDays = JsonReader.double(source, "lockupDurationDays"),
        )
}
