import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { DoubleChevronIcon, EurCodeIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { startOfDay } from "date-fns";
import { useMemo } from "react";
import { type Control, Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import {
    type BudgetType,
    getCapPeriod,
} from "@/module/campaigns/utils/capPeriods";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { InputNumber } from "@/module/forms/InputNumber";
import {
    type CampaignDraft,
    campaignStore,
    getStartDate,
    setStartDate,
} from "@/stores/campaignStore";
import { WizardFieldCard } from "../WizardFieldCard";
import { WizardStep } from "../WizardStep";
import * as styles from "./budget.css";
import { DateField } from "./DateField";

const FORM_ID = "campaign-budget-form";
const FRAK_COMMISSION = 0.2;

type ScheduleMode = "immediate" | "startOnly" | "range";

type BudgetFormValues = {
    period: BudgetType;
    amount: number;
    scheduleMode?: ScheduleMode;
    startDate?: string;
    endDate?: string;
};

const PERIODS = [
    { value: "global", labelKey: "campaigns.create.budget.period.global" },
    { value: "daily", labelKey: "campaigns.create.budget.period.daily" },
    { value: "weekly", labelKey: "campaigns.create.budget.period.weekly" },
    { value: "monthly", labelKey: "campaigns.create.budget.period.monthly" },
] as const satisfies ReadonlyArray<{ value: BudgetType; labelKey: string }>;

const PERIOD_LABEL: Record<BudgetType, string> = {
    global: "Global",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
};

const SCHEDULE_OPTIONS = [
    {
        value: "immediate",
        titleKey: "campaigns.create.budget.schedule.immediate.title",
        descKey: "campaigns.create.budget.schedule.immediate.description",
    },
    {
        value: "startOnly",
        titleKey: "campaigns.create.budget.schedule.startOnly.title",
        descKey: "campaigns.create.budget.schedule.startOnly.description",
    },
    {
        value: "range",
        titleKey: "campaigns.create.budget.schedule.range.title",
        descKey: "campaigns.create.budget.schedule.range.description",
    },
] as const satisfies ReadonlyArray<{
    value: ScheduleMode;
    titleKey: string;
    descKey: string;
}>;

function periodFromDuration(duration: number | null | undefined): BudgetType {
    if (duration === getCapPeriod("daily")) return "daily";
    if (duration === getCapPeriod("weekly")) return "weekly";
    if (duration === getCapPeriod("monthly")) return "monthly";
    return "global";
}

function draftToBudgetValues(draft: CampaignDraft): BudgetFormValues {
    const budget = draft.budgetConfig[0];
    const startDate = getStartDate(draft.rule);
    const endDate = draft.expiresAt;
    let scheduleMode: ScheduleMode | undefined;
    if (endDate) scheduleMode = "range";
    else if (startDate) scheduleMode = "startOnly";

    return {
        period: periodFromDuration(budget?.durationInSeconds),
        amount: budget?.amount ?? 0,
        scheduleMode,
        startDate,
        endDate,
    };
}

function budgetValuesToDraft(
    values: BudgetFormValues,
    draft: CampaignDraft
): CampaignDraft {
    const rule = setStartDate(
        draft.rule,
        values.scheduleMode === "immediate" ? undefined : values.startDate
    );
    return {
        ...draft,
        budgetConfig: [
            {
                label: PERIOD_LABEL[values.period],
                durationInSeconds: getCapPeriod(values.period),
                amount: values.amount,
            },
        ],
        rule,
        expiresAt: values.scheduleMode === "range" ? values.endDate : undefined,
    };
}

/* ------------------------------------------------------------------ */

function BudgetPeriodField({
    control,
}: {
    control: Control<BudgetFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="period"
            render={({ field }) => (
                <RadioGroup
                    className={styles.periodRow}
                    value={field.value}
                    onValueChange={field.onChange}
                >
                    {PERIODS.map((period) => (
                        <label
                            key={period.value}
                            htmlFor={`period-${period.value}`}
                            className={styles.periodOption}
                        >
                            <RadioGroupItem
                                id={`period-${period.value}`}
                                value={period.value}
                            />
                            <Text variant="body">{t(period.labelKey)}</Text>
                        </label>
                    ))}
                </RadioGroup>
            )}
        />
    );
}

function BudgetBreakdown({ amount }: { amount: number }) {
    const { t } = useTranslation();
    const hasAmount = amount > 0;
    const rewards = Math.round(amount * (1 - FRAK_COMMISSION) * 100) / 100;
    const commission = Math.round(amount * FRAK_COMMISSION * 100) / 100;

    return (
        <div className={styles.breakdown}>
            <div className={styles.bar}>
                {hasAmount ? (
                    <>
                        <div className={styles.barRewards} />
                        <div className={styles.barCommission} />
                    </>
                ) : (
                    <div className={styles.barEmpty} />
                )}
            </div>
            <div className={styles.legend}>
                <span className={styles.legendItem}>
                    <span
                        className={`${styles.legendSquare} ${hasAmount ? styles.squareRewards : styles.squareEmpty}`}
                    />
                    <Text variant="caption" color="primary">
                        {t("campaigns.create.budget.cap.rewards")} (
                        {hasAmount ? 80 : 0}%) ·{" "}
                        <span className={styles.amountRewards}>{rewards}€</span>
                    </Text>
                </span>
                <span className={styles.legendItem}>
                    <span
                        className={`${styles.legendSquare} ${hasAmount ? styles.squareCommission : styles.squareEmpty}`}
                    />
                    <Text variant="caption" color="primary">
                        {t("campaigns.create.budget.cap.commission")} (
                        {hasAmount ? 20 : 0}%) ·{" "}
                        <span className={styles.amountCommission}>
                            {commission}€
                        </span>
                    </Text>
                </span>
            </div>
        </div>
    );
}

/**
 * Double-chevron stepper: a single glyph with two transparent hit zones
 * (top half increments, bottom half decrements). Clamped to >= 0.
 */
function NumberStepper({
    value,
    onChange,
    step = 1,
}: {
    value: number | string;
    onChange: (next: number) => void;
    step?: number;
}) {
    const current = typeof value === "number" ? value : Number(value) || 0;
    return (
        <span className={styles.stepper}>
            <DoubleChevronIcon
                width={24}
                height={24}
                className={styles.stepperIcon}
            />
            <button
                type="button"
                tabIndex={-1}
                aria-label="increment"
                className={styles.stepperUp}
                onClick={() => onChange(current + step)}
            />
            <button
                type="button"
                tabIndex={-1}
                aria-label="decrement"
                className={styles.stepperDown}
                onClick={() => onChange(Math.max(0, current - step))}
            />
        </span>
    );
}

function BudgetCapField({ control }: { control: Control<BudgetFormValues> }) {
    const { t } = useTranslation();
    const amount = useWatch({ control, name: "amount" });

    return (
        <div className={styles.capContent}>
            <Controller
                control={control}
                name="amount"
                rules={{ validate: (v) => (v ?? 0) > 0 }}
                render={({ field }) => (
                    <InputNumber
                        variant="bare"
                        tone="muted"
                        classNameWrapper={styles.capInputWrapper}
                        rightSection={
                            <span className={styles.capRight}>
                                <NumberStepper
                                    value={field.value}
                                    onChange={field.onChange}
                                />
                                <EurCodeIcon
                                    width={24}
                                    height={24}
                                    className={styles.eurIcon}
                                />
                            </span>
                        }
                        placeholder={t(
                            "campaigns.create.budget.cap.placeholder"
                        )}
                        {...field}
                        value={field.value || ""}
                    />
                )}
            />
            <Text variant="caption" color="tertiary" className={styles.capHint}>
                {t("campaigns.create.budget.cap.hint")}
            </Text>
            <BudgetBreakdown amount={amount ?? 0} />
        </div>
    );
}

function ScheduleField({ control }: { control: Control<BudgetFormValues> }) {
    const { t } = useTranslation();
    const mode = useWatch({ control, name: "scheduleMode" });
    const startDate = useWatch({ control, name: "startDate" });
    const endDate = useWatch({ control, name: "endDate" });
    const today = startOfDay(new Date());

    const showDates = mode === "startOnly" || mode === "range";

    return (
        <Stack space="xs">
            <Controller
                control={control}
                name="scheduleMode"
                rules={{ required: true }}
                render={({ field }) => (
                    <RadioGroup
                        className={styles.scheduleRow}
                        value={field.value}
                        onValueChange={field.onChange}
                    >
                        {SCHEDULE_OPTIONS.map((option) => (
                            <label
                                key={option.value}
                                htmlFor={`schedule-${option.value}`}
                                className={styles.scheduleOption}
                            >
                                <RadioGroupItem
                                    id={`schedule-${option.value}`}
                                    value={option.value}
                                />
                                <span className={styles.scheduleMain}>
                                    <Text variant="body" weight="medium">
                                        {t(option.titleKey)}
                                    </Text>
                                    <Text variant="bodySmall" color="secondary">
                                        {t(option.descKey)}
                                    </Text>
                                </span>
                            </label>
                        ))}
                    </RadioGroup>
                )}
            />

            {showDates && <div className={styles.divider} />}

            {mode === "startOnly" && (
                <Controller
                    control={control}
                    name="startDate"
                    rules={{ validate: (v) => Boolean(v) }}
                    render={({ field }) => (
                        <DateField
                            value={field.value}
                            onChange={field.onChange}
                            minDate={today}
                        />
                    )}
                />
            )}

            {mode === "range" && (
                <div className={styles.dateFields}>
                    <div className={styles.dateColumn}>
                        <Text variant="bodySmall" color="secondary">
                            {t("campaigns.create.budget.schedule.startDate")}
                        </Text>
                        <Controller
                            control={control}
                            name="startDate"
                            rules={{
                                validate: (v) => Boolean(v),
                                deps: ["endDate"],
                            }}
                            render={({ field }) => (
                                <DateField
                                    value={field.value}
                                    onChange={field.onChange}
                                    minDate={today}
                                    maxDate={
                                        endDate ? new Date(endDate) : undefined
                                    }
                                />
                            )}
                        />
                    </div>
                    <div className={styles.dateColumn}>
                        <Text variant="bodySmall" color="secondary">
                            {t("campaigns.create.budget.schedule.endDate")}
                        </Text>
                        <Controller
                            control={control}
                            name="endDate"
                            rules={{
                                validate: (v) =>
                                    v
                                        ? !startDate ||
                                          new Date(v).getTime() >=
                                              new Date(startDate).getTime()
                                        : false,
                            }}
                            render={({ field }) => (
                                <DateField
                                    value={field.value}
                                    onChange={field.onChange}
                                    minDate={
                                        startDate ? new Date(startDate) : today
                                    }
                                />
                            )}
                        />
                    </div>
                </div>
            )}
        </Stack>
    );
}

export function BudgetCampaign() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((s) => s.draft);
    const updateDraft = campaignStore((s) => s.updateDraft);
    const saveCampaign = useSaveCampaign();

    const defaultValues = useMemo(() => draftToBudgetValues(draft), [draft]);

    const form = useForm<BudgetFormValues>({
        values: defaultValues,
        mode: "onChange",
    });

    async function persist(values: BudgetFormValues) {
        const updated = budgetValuesToDraft(values, { ...draft, merchantId });
        updateDraft(() => updated);
        return saveCampaign.mutateAsync(updated);
    }

    async function onSubmit(values: BudgetFormValues) {
        const saved = await persist(values);
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/metrics",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(persist);

    return (
        <WizardStep
            stepKey="budget"
            formId={FORM_ID}
            isValid={form.formState.isValid}
            isPending={saveCampaign.isPending}
            onSaveDraft={handleSaveDraft}
            onClose={() => form.reset(defaultValues)}
        >
            <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                <Stack space="l">
                    <WizardFieldCard
                        space="xs"
                        label={t("campaigns.create.budget.period.label")}
                    >
                        <BudgetPeriodField control={form.control} />
                    </WizardFieldCard>

                    <WizardFieldCard
                        space="xs"
                        insetLabel
                        label={t("campaigns.create.budget.cap.label")}
                    >
                        <BudgetCapField control={form.control} />
                    </WizardFieldCard>

                    <WizardFieldCard
                        space="xs"
                        label={t("campaigns.create.budget.schedule.label")}
                        description={t(
                            "campaigns.create.budget.schedule.description"
                        )}
                    >
                        <ScheduleField control={form.control} />
                    </WizardFieldCard>
                </Stack>
            </form>
        </WizardStep>
    );
}
