import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    formatCurrency,
    type RewardHistoryItem,
    type RewardPlan,
} from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { formatDayMonth } from "@/module/history/utils/formatDayMonth";
import {
    approximately,
    type PlanStepView,
    planProgressKey,
    planStepLabelKey,
    planStepViews,
} from "@/module/history/utils/rewardPlan";

type PlanDetailProps = {
    item: RewardHistoryItem;
    plan: RewardPlan;
    locale: string;
};

const stepAmountColors = {
    paid: "success",
    unlocking: "primary",
    upcoming: "primary",
    expired: "disabled",
} as const satisfies Record<PlanStepView["status"], string>;

export function PlanDetail({ item, plan, locale }: PlanDetailProps) {
    const { t } = useTranslation();
    const money = (eurAmount: number) =>
        formatCurrency(eurAmount, "EUR", locale);
    const lost = item.status === "cancelled" || item.status === "expired";
    const total = money(item.amount.eurAmount);

    return (
        <Stack space="m">
            <InfoCard>
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("reward.plan.total")}
                    action={
                        <Text variant="bodySmall" weight="semiBold">
                            {approximately(
                                lost ? total : `+${total}`,
                                plan.estimated
                            )}
                        </Text>
                    }
                />
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("reward.plan.paid")}
                    action={
                        <Text variant="bodySmall" weight="medium">
                            {money(plan.paidAmount.eurAmount)}
                        </Text>
                    }
                />
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("reward.plan.pending")}
                    action={
                        <Text variant="bodySmall" weight="medium">
                            {approximately(
                                money(plan.pendingAmount.eurAmount),
                                plan.estimated
                            )}
                        </Text>
                    }
                />
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    labelWeight="regular"
                    label={t(planProgressKey(plan), {
                        count: plan.stepsEarned,
                        total: plan.stepsTotal,
                    })}
                />
            </InfoCard>
            <InfoCard>
                {planStepViews(plan, item.role).map((view) => (
                    <PlanStepRow
                        key={view.step}
                        view={view}
                        labelKey={planStepLabelKey(plan)}
                        locale={locale}
                    />
                ))}
            </InfoCard>
        </Stack>
    );
}

function PlanStepRow({
    view,
    labelKey,
    locale,
}: {
    view: PlanStepView;
    labelKey: ReturnType<typeof planStepLabelKey>;
    locale: string;
}) {
    const { t } = useTranslation();
    const amount = approximately(
        formatCurrency(view.eurAmount, "EUR", locale),
        view.estimated
    );
    const caption =
        view.labelKey === "reward.plan.step.upcomingDuration"
            ? t(view.labelKey, { count: view.days ?? 0 })
            : t(view.labelKey, {
                  date: view.date ? formatDayMonth(view.date, locale) : "",
              });

    return (
        <InfoRow
            labelVariant="bodySmall"
            labelColor="secondary"
            label={t(labelKey, { step: view.step })}
            action={
                <Stack space="none" align="right">
                    <Text
                        variant="bodySmall"
                        weight="medium"
                        color={stepAmountColors[view.status]}
                    >
                        {amount}
                    </Text>
                    <Text variant="caption" color="secondary">
                        {caption}
                    </Text>
                </Stack>
            }
        />
    );
}
