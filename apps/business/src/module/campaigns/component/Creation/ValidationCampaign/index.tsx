import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { BankIcon, CalendarIcon } from "@frak-labs/design-system/icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
    draftToRewardForm,
    splitTargetCpa,
} from "@/module/campaigns/component/Creation/RewardCampaign/utils";
import { WizardStep } from "@/module/campaigns/component/Creation/WizardStep";
import { useCampaignCurrencyGlyph } from "@/module/campaigns/hook/useCampaignCurrencyGlyph";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useStatusTransition } from "@/module/campaigns/hook/useStatusTransition";
import { getCapPeriod } from "@/module/campaigns/utils/capPeriods";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { DetailRow, DetailValue } from "@/module/common/component/DetailRow";
import { getCountryName } from "@/module/common/utils/countries";
import { formatDate } from "@/module/common/utils/formatDate";
import {
    type CampaignDraft,
    campaignStore,
    getStartDate,
} from "@/stores/campaignStore";
import { InfoBanner } from "../InfoBanner";
import { CampaignLaunched } from "./CampaignLaunched";

const FORM_ID = "campaign-validation-form";
const EMPTY = "—";

export function ValidationCampaign() {
    const { t } = useTranslation();
    const isDemoMode = useIsDemoMode();
    const queryClient = useQueryClient();

    const draft = campaignStore((s) => s.draft);
    const isSuccess = campaignStore((s) => s.isSuccess);
    const setSuccess = campaignStore((s) => s.setSuccess);

    const saveCampaign = useSaveCampaign();
    const { mutateAsync: publishCampaign } = useStatusTransition();

    const {
        mutate: publish,
        isPending,
        isError,
    } = useMutation({
        mutationKey: ["campaign", "save-publish"],
        mutationFn: async () => {
            if (isDemoMode) {
                await new Promise((r) => setTimeout(r, 1000));
                return;
            }
            const saved = await saveCampaign.mutateAsync(draft);
            if (!saved?.id) throw new Error("Failed to save campaign");
            await publishCampaign({
                merchantId: draft.merchantId,
                campaignId: saved.id,
                action: "publish",
            });
        },
        onSuccess: async () => {
            setSuccess(true);
            await queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        },
    });

    if (isSuccess) {
        return <CampaignLaunched />;
    }

    const isLoading = isPending || saveCampaign.isPending;

    return (
        <WizardStep
            stepKey="validation"
            formId={FORM_ID}
            isValid
            isPending={isLoading}
            onSaveDraft={() => saveCampaign.mutate(draft)}
        >
            <form
                id={FORM_ID}
                onSubmit={(e) => {
                    e.preventDefault();
                    publish();
                }}
            >
                <Stack space="m">
                    {isError && (
                        <InfoBanner tone="error">
                            {t("campaigns.create.validation.publishError")}
                        </InfoBanner>
                    )}
                    <Card radius="m" variant="elevated" padding="none">
                        <Box paddingX="m">
                            <DetailRows draft={draft} />
                        </Box>
                    </Card>
                </Stack>
            </form>
        </WizardStep>
    );
}

function DetailRows({ draft }: { draft: CampaignDraft }) {
    const { t } = useTranslation();
    const currencyGlyph = useCampaignCurrencyGlyph();
    const reward = useMemo(() => draftToRewardForm(draft), [draft]);

    const goal = draft.metadata.goal;
    const territories = draft.metadata.territories ?? [];
    const specialCategories = draft.metadata.specialCategories ?? [];
    const startDate = formatIso(getStartDate(draft.rule));
    const endDate = formatIso(draft.expiresAt);
    const trigger = draft.rule.trigger;

    const budget = draft.budgetConfig[0];
    const amount = budget?.amount ?? 0;
    const period = budgetPeriodKey(budget?.durationInSeconds);
    const { rewardsPool, frakCommission } = splitTargetCpa(amount);

    const scheduleText = `${
        startDate ?? t("campaigns.create.validation.startImmediately")
    } · ${endDate ?? t("campaigns.create.validation.noEndDate")}`;

    return (
        <>
            <DetailRow label={t("campaigns.create.validation.campaignTitle")}>
                <DetailValue>{draft.name}</DetailValue>
            </DetailRow>

            <DetailRow label={t("campaigns.create.validation.goal")}>
                {goal ? (
                    <DetailValue>
                        {t(
                            `campaigns.create.goals.options.${goal}.title` as "campaigns.create.goals.options.sales.title"
                        )}
                    </DetailValue>
                ) : (
                    <DetailValue muted>{EMPTY}</DetailValue>
                )}
            </DetailRow>

            <DetailRow label={t("campaigns.create.validation.territories")}>
                {territories.length > 0 ? (
                    <DetailValue>
                        {territories.map(getCountryName).join(", ")}
                    </DetailValue>
                ) : (
                    <DetailValue muted>{EMPTY}</DetailValue>
                )}
            </DetailRow>

            <DetailRow
                label={t("campaigns.create.validation.specialCategories")}
            >
                {specialCategories.length > 0 ? (
                    <DetailValue>
                        {specialCategories
                            .map((category) =>
                                t(
                                    `campaigns.create.territory.special.options.${category}.title` as "campaigns.create.territory.special.options.credit.title"
                                )
                            )
                            .join(", ")}
                    </DetailValue>
                ) : (
                    <DetailValue muted>{EMPTY}</DetailValue>
                )}
            </DetailRow>

            <DetailRow label={t("campaigns.create.validation.schedule")}>
                <Inline space="xxs" alignY="center">
                    <CalendarIcon width={16} height={16} />
                    <DetailValue>{scheduleText}</DetailValue>
                </Inline>
            </DetailRow>

            <DetailRow label={t("campaigns.create.validation.trigger")}>
                {trigger ? (
                    <DetailValue>
                        {t(`campaigns.create.reward.trigger.${trigger}`)}
                    </DetailValue>
                ) : (
                    <DetailValue muted>{EMPTY}</DetailValue>
                )}
            </DetailRow>

            <DetailRow label={t("campaigns.create.validation.budgetPeriod")}>
                <DetailValue>
                    {t(`campaigns.create.budget.period.${period}`)}
                </DetailValue>
            </DetailRow>

            <DetailRow
                label={t("campaigns.create.validation.budgetAmount")}
                tall
            >
                <Stack space="xxs" align="right">
                    <Inline space="xxs" alignY="center">
                        <BankIcon width={16} height={16} />
                        <DetailValue>{`${amount} ${currencyGlyph}`}</DetailValue>
                    </Inline>
                    <Text variant="caption" weight="medium" color="tertiary">
                        {t("campaigns.create.validation.budgetBreakdown", {
                            distributed: rewardsPool,
                            frak: frakCommission,
                            currency: currencyGlyph,
                        })}
                    </Text>
                </Stack>
            </DetailRow>

            <RewardRows reward={reward} currencyGlyph={currencyGlyph} />

            <DetailRow label={t("campaigns.create.validation.rewardLockup")}>
                {reward.lockupDays ? (
                    <DetailValue>
                        {t("campaigns.create.validation.lockupValue", {
                            count: Number(reward.lockupDays),
                        })}
                    </DetailValue>
                ) : (
                    <DetailValue muted>{EMPTY}</DetailValue>
                )}
            </DetailRow>
        </>
    );
}

/** Target CPA + Rewards rows. Tiered lists each basket tier and its split. */
function RewardRows({
    reward,
    currencyGlyph,
}: {
    reward: ReturnType<typeof draftToRewardForm>;
    currencyGlyph: string;
}) {
    const { t } = useTranslation();

    if (reward.model === "tiered") {
        const tiers = reward.globalCpaTiers;
        return (
            <>
                <DetailRow label={t("campaigns.create.validation.targetCpa")}>
                    <DetailValue>
                        {t("campaigns.create.validation.tieredTiers", {
                            count: tiers.length,
                        })}
                    </DetailValue>
                </DetailRow>
                <DetailRow
                    label={t("campaigns.create.validation.rewards")}
                    tall
                >
                    <Stack space="xs" align="right">
                        {tiers.map((tier, i) => {
                            const isLast = i === tiers.length - 1;
                            const unit =
                                tier.unit === "percent" ? "%" : currencyGlyph;
                            const upper =
                                tier.to === "" ? (isLast ? "∞" : "") : tier.to;
                            const from = tier.from === "" ? 0 : tier.from;
                            return (
                                <Stack
                                    key={`${tier.from}-${tier.to}`}
                                    space="xxs"
                                    align="right"
                                >
                                    <DetailValue>{`${from} → ${upper} · ${tier.cpa}${unit}`}</DetailValue>
                                    <Text
                                        variant="caption"
                                        weight="medium"
                                        color="tertiary"
                                    >
                                        {t(
                                            "campaigns.create.validation.ambassador",
                                            {
                                                value: `${reward.ambassadorTiers[i]?.reward ?? 0}${unit}`,
                                            }
                                        )}
                                        {" · "}
                                        {t(
                                            "campaigns.create.validation.referee",
                                            {
                                                value: `${reward.refereeTiers[i]?.reward ?? 0}${unit}`,
                                            }
                                        )}
                                    </Text>
                                </Stack>
                            );
                        })}
                    </Stack>
                </DetailRow>
            </>
        );
    }

    if (reward.model === "fixed" || reward.model === "percentage") {
        const isPercent = reward.model === "percentage";
        const unit = isPercent ? "%" : currencyGlyph;
        const cpa = isPercent ? reward.targetCpaPercent : reward.targetCpa;
        const ambassador = isPercent
            ? reward.ambassadorPercent
            : reward.ambassadorAmount;
        const referee = isPercent
            ? reward.refereePercent
            : reward.refereeAmount;
        const { frakCommission } = splitTargetCpa(cpa);

        return (
            <>
                <DetailRow label={t("campaigns.create.validation.targetCpa")}>
                    <DetailValue>{`${cpa}${unit}`}</DetailValue>
                </DetailRow>
                <DetailRow
                    label={t("campaigns.create.validation.rewards")}
                    tall
                >
                    <Stack space="xxs" align="right">
                        <DetailValue>
                            {t("campaigns.create.validation.ambassador", {
                                value: `${ambassador}${unit}`,
                            })}
                        </DetailValue>
                        <DetailValue>
                            {t("campaigns.create.validation.referee", {
                                value: `${referee}${unit}`,
                            })}
                        </DetailValue>
                        <Text
                            variant="caption"
                            weight="medium"
                            color="tertiary"
                        >
                            {t("campaigns.create.validation.frak", {
                                value: `${frakCommission}${unit}`,
                            })}
                        </Text>
                    </Stack>
                </DetailRow>
            </>
        );
    }

    return (
        <>
            <DetailRow label={t("campaigns.create.validation.targetCpa")}>
                <DetailValue muted>{EMPTY}</DetailValue>
            </DetailRow>
            <DetailRow label={t("campaigns.create.validation.rewards")}>
                <DetailValue muted>{EMPTY}</DetailValue>
            </DetailRow>
        </>
    );
}

/** Format an ISO date string for display, or `undefined` when unset. */
function formatIso(iso?: string) {
    return iso ? formatDate(new Date(iso)) : undefined;
}

/** Inverse of `getCapPeriod`: budget duration in seconds → period i18n key. */
function budgetPeriodKey(duration: number | null | undefined) {
    if (duration === getCapPeriod("daily")) return "daily";
    if (duration === getCapPeriod("weekly")) return "weekly";
    if (duration === getCapPeriod("monthly")) return "monthly";
    return "global";
}
