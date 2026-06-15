import { tokenAddressToCurrencyGlyph } from "@/module/common/utils/currencyOptions";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { campaignStore } from "@/stores/campaignStore";

/**
 * The reward-currency glyph (€ / £ / $) for the draft being edited, resolved
 * from the chosen reward token or — when left on "use default" — the merchant
 * default. Shared by every wizard step that renders a reward/budget amount.
 */
export function useCampaignCurrencyGlyph(): string {
    const rewardToken = campaignStore((s) => s.draft.rewardToken);
    const merchantId = campaignStore((s) => s.draft.merchantId);
    const { data: merchant } = useMerchant({ merchantId });
    return tokenAddressToCurrencyGlyph(
        rewardToken ?? merchant?.defaultRewardToken
    );
}
