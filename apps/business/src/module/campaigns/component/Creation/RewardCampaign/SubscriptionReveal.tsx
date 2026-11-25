import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowRightIcon, PlusIcon } from "@frak-labs/design-system/icons";
import type { TFunction } from "i18next";
import { memo, useCallback } from "react";
import {
    type Control,
    Controller,
    type UseFormSetValue,
    useFieldArray,
    useWatch,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { Input } from "@/module/forms/Input";
import {
    CpaSplit,
    type CpaSplitProps,
    useFixedSplitLabels,
    usePercentSplitLabels,
} from "./CpaReveal";
import { useCurrencyGlyph } from "./currencyGlyph";
import { TriggeredRow } from "./RevealParts";
import * as styles from "./reward.css";
import { StepperField } from "./StepperField";
import { PlanTotalsSummary } from "./SubscriptionFields";
import {
    emptyPeriod,
    MAX_PLAN_STEPS,
    periodTitle,
    periodUnit,
    planTotalLabels,
    type StepBy,
    stepAfter,
    stepMoment,
    type VisibleIssue,
    visibleIssues,
} from "./subscription";
import { TierDelete, TierField } from "./TierCard";
import type { RewardFormValues } from "./utils";

type SplitLabels = Omit<
    CpaSplitProps,
    "control" | "setValue" | "unit" | "cpaName" | "ambName" | "refName"
>;

type PlanModel = "fixed" | "percentage";

const PERIODS_KEY = "campaigns.create.reward.subscription.periods";

function issueMessage(t: TFunction, issue: VisibleIssue, stepBy: StepBy) {
    const key = `${PERIODS_KEY}.issues` as const;
    switch (issue) {
        case "range":
            return t(`${key}.range.${stepBy}`, { max: MAX_PLAN_STEPS });
        case "bounds":
            return t(`${key}.bounds`);
        case "edgeEmpty":
            return t(`${key}.edgeEmpty`);
        case "firstMissing":
            return t(`${key}.firstMissing`);
    }
}

/** "First payment → Renewal 4", or "Day 30" for a one-step period. */
function momentCaption(
    t: TFunction,
    values: Pick<RewardFormValues, "stepBy" | "stepAmount" | "stepDays">,
    glyph: string,
    from: number | "",
    to: number | ""
): string | undefined {
    if (from === "") return undefined;
    const describe = (step: number) => stepMoment(t, values, step, glyph);
    const start = describe(from);
    const end = to === "" || to === from ? undefined : describe(Number(to));
    if (!start) return undefined;
    return end ? `${start} → ${end}` : start;
}

function PeriodRange({
    control,
    index,
    from,
    stepBy,
    isLast,
}: {
    control: Control<RewardFormValues>;
    index: number;
    from: number | "";
    stepBy: StepBy;
    isLast: boolean;
}) {
    const { t } = useTranslation();
    const fromId = `period-${index}-from`;
    return (
        <Inline space="xxs" alignY="bottom">
            <TierField
                label={t(`${PERIODS_KEY}.range.${stepBy}`)}
                htmlFor={fromId}
            >
                <Input
                    id={fromId}
                    variant="bare"
                    tone="elevated"
                    value={from}
                    disabled
                />
            </TierField>
            <span className={styles.tierArrow}>
                <ArrowRightIcon width={24} height={24} />
            </span>
            <TierField>
                <Controller
                    control={control}
                    name={`periods.${index}.to`}
                    render={({ field }) => (
                        <StepperField
                            field={field}
                            tone="elevated"
                            ariaLabel={t(`${PERIODS_KEY}.toLabel.${stepBy}`)}
                            placeholder={t(
                                isLast
                                    ? `${PERIODS_KEY}.lastPlaceholder`
                                    : `${PERIODS_KEY}.toPlaceholder`
                            )}
                        />
                    )}
                />
            </TierField>
        </Inline>
    );
}

type PeriodCardProps = {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
    index: number;
    count: number;
    unit: "amount" | "percent";
    labels: SplitLabels;
    onRemove: (index: number) => void;
};

/** One period; it watches only its own end, the one before it and the step size. */
const PeriodCard = memo(function PeriodCard({
    control,
    setValue,
    index,
    count,
    unit,
    labels,
    onRemove,
}: PeriodCardProps) {
    const { t } = useTranslation();
    const glyph = useCurrencyGlyph();
    const [stepBy, stepAmount, stepDays] = useWatch({
        control,
        name: ["stepBy", "stepAmount", "stepDays"],
    });
    const to = useWatch({ control, name: `periods.${index}.to` }) ?? "";
    const previousTo = useWatch({
        control,
        name: `periods.${Math.max(index - 1, 0)}.to`,
    });
    const from = index === 0 ? 1 : stepAfter(previousTo);
    const title = periodTitle(t, stepBy, { from, to }, count === 1);
    const moment = momentCaption(
        t,
        { stepBy, stepAmount, stepDays },
        glyph,
        from,
        to
    );
    return (
        <Stack space="m" padding="m" className={styles.tierCard}>
            <Inline space="none" align="space-between" alignY="center">
                <Stack space="none">
                    <Text variant="body">{title}</Text>
                    {moment && (
                        <Text variant="caption" color="tertiary">
                            {moment}
                        </Text>
                    )}
                </Stack>
                {index > 0 && (
                    <TierDelete
                        onRemove={() => onRemove(index)}
                        label={t(`${PERIODS_KEY}.remove`)}
                    />
                )}
            </Inline>
            <PeriodRange
                control={control}
                index={index}
                from={from}
                stepBy={stepBy}
                isLast={index === count - 1}
            />
            <CpaSplit
                control={control}
                setValue={setValue}
                unit={unit}
                cpaName={`periods.${index}.${unit}.cpa`}
                ambName={`periods.${index}.${unit}.ambassador`}
                refName={`periods.${index}.${unit}.referee`}
                {...labels}
            />
        </Stack>
    );
});

/** The split labels of the model; a percentage reads per payment, or per step amount. */
function useSplitLabels(unit: "amount" | "percent", stepBy: StepBy) {
    const { t } = useTranslation();
    const fixed = useFixedSplitLabels();
    const percent = usePercentSplitLabels(
        stepBy === "amount"
            ? t("campaigns.create.reward.subscription.percentStepHint")
            : t("campaigns.create.reward.subscription.percentHint")
    );
    return unit === "percent" ? percent : fixed;
}

/** What the whole plan needs to show: its blocking issues, its hint and its totals. */
function PlanSummary({
    control,
    model,
}: {
    control: Control<RewardFormValues>;
    model: PlanModel;
}) {
    const { t } = useTranslation();
    const glyph = useCurrencyGlyph();
    const [periods, stepBy, stepAmount] = useWatch({
        control,
        name: ["periods", "stepBy", "stepAmount"],
    });
    const values = { periods, model, stepBy, stepAmount };
    return (
        <>
            {visibleIssues(values).map((issue) => (
                <FieldError key={issue}>
                    {issueMessage(t, issue, stepBy)}
                </FieldError>
            ))}

            <Text variant="caption" color="tertiary">
                {t(`${PERIODS_KEY}.hint.${stepBy}`, { max: MAX_PLAN_STEPS })}
            </Text>

            <PlanTotalsSummary labels={planTotalLabels(values, glyph)} />
        </>
    );
}

/** Fixed and % subscription rewards: the shared CPA split once per plan period. */
export function SubscriptionPeriodsReveal({
    control,
    setValue,
    model,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
    model: PlanModel;
}) {
    const { t } = useTranslation();
    const unit = periodUnit(model);
    const { fields, append, remove } = useFieldArray({
        control,
        name: "periods",
    });
    const stepBy = useWatch({ control, name: "stepBy" });
    const labels = useSplitLabels(unit, stepBy);
    const removePeriod = useCallback(
        (index: number) => remove(index),
        [remove]
    );
    const count = fields.length;

    return (
        <Stack space="m">
            <Stack space="xxs">
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {t("campaigns.create.reward.value.label")}
                </Text>
                <Text variant="caption" color="tertiary">
                    {t(`${PERIODS_KEY}.description`)}
                </Text>
            </Stack>

            {fields.map((row, index) => (
                <PeriodCard
                    key={row.id}
                    control={control}
                    setValue={setValue}
                    index={index}
                    count={count}
                    unit={unit}
                    labels={labels}
                    onRemove={removePeriod}
                />
            ))}

            <Inline space="none">
                <Button
                    type="button"
                    variant="primary"
                    size="small"
                    rightIcon={<PlusIcon width={16} height={16} />}
                    onClick={() => append(emptyPeriod())}
                >
                    {t(`${PERIODS_KEY}.add`)}
                </Button>
            </Inline>

            <PlanSummary control={control} model={model} />

            <TriggeredRow />
        </Stack>
    );
}
