import { Stack } from "@frak-labs/design-system/components/Stack";
import { useTranslation } from "react-i18next";
import {
    periodStart,
    periodTitle,
    periodValues,
    planTotalLabels,
    progressionLabel,
} from "@/module/campaigns/component/Creation/RewardCampaign/subscription";
import type { RewardFormValues } from "@/module/campaigns/component/Creation/RewardCampaign/utils";
import { DetailRow, DetailValue } from "@/module/common/component/DetailRow";

/** One row per plan period: who gets what on each of its steps. */
function PeriodRows({
    reward,
    glyph,
}: {
    reward: RewardFormValues;
    glyph: string;
}) {
    const { t } = useTranslation();
    const suffix = reward.model === "percentage" ? "%" : glyph;
    return reward.periods.map((period, index) => {
        const from = periodStart(reward.periods, index);
        const title = periodTitle(
            t,
            reward.stepBy,
            { from, to: period.to },
            reward.periods.length === 1
        );
        const own = periodValues(period, reward.model);
        return (
            <DetailRow key={`${from}-${period.to}`} label={title} tall>
                <Stack space="xxs" align="right">
                    <DetailValue>
                        {t("campaigns.create.validation.ambassador", {
                            value: `${Number(own.ambassador) || 0}${suffix}`,
                        })}
                    </DetailValue>
                    <DetailValue>
                        {t("campaigns.create.validation.referee", {
                            value: `${Number(own.referee) || 0}${suffix}`,
                        })}
                    </DetailValue>
                </Stack>
            </DetailRow>
        );
    });
}

/** How rewards after the first payment unlock, with the progression's step size. */
function ProgressionRow({
    reward,
    glyph,
}: {
    reward: RewardFormValues;
    glyph: string;
}) {
    const { t } = useTranslation();
    return (
        <DetailRow
            label={t(
                "campaigns.create.validation.subscription.progression.label"
            )}
        >
            <DetailValue>{progressionLabel(t, reward, glyph)}</DetailValue>
        </DetailRow>
    );
}

/** Subscription campaigns: progression, each period, plan cost and inactivity window. */
export function SubscriptionRewardRows({
    reward,
    currencyGlyph,
}: {
    reward: RewardFormValues;
    currencyGlyph: string;
}) {
    const { t } = useTranslation();

    if (reward.unsupportedSubscription) {
        return (
            <DetailRow label={t("campaigns.create.validation.rewards")}>
                <DetailValue>
                    {t("campaigns.create.validation.subscription.unchanged")}
                </DetailValue>
            </DetailRow>
        );
    }

    const totals = planTotalLabels(reward, currencyGlyph);
    return (
        <>
            <ProgressionRow reward={reward} glyph={currencyGlyph} />
            <PeriodRows reward={reward} glyph={currencyGlyph} />
            <DetailRow
                label={t("campaigns.create.validation.subscription.planCpa")}
                tall
            >
                <Stack space="xxs" align="right">
                    <DetailValue>{totals.cpa}</DetailValue>
                    <DetailValue muted>
                        {t(
                            "campaigns.create.validation.subscription.planCpaSplit",
                            {
                                rewards: `${totals.referrer} + ${totals.referee}`,
                                commission: totals.commission,
                            }
                        )}
                    </DetailValue>
                </Stack>
            </DetailRow>
            <DetailRow
                label={t("campaigns.create.validation.subscription.inactivity")}
            >
                <DetailValue>
                    {t(
                        "campaigns.create.validation.subscription.inactivityValue",
                        { count: Number(reward.inactivityDays) }
                    )}
                </DetailValue>
            </DetailRow>
        </>
    );
}
