import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    type Control,
    Controller,
    type UseFormSetValue,
    useWatch,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DistributionBar } from "../DistributionBar";
import { useCurrencyGlyph } from "./currencyGlyph";
import { RecoBar, RevealHeader, TriggeredRow } from "./RevealParts";
import * as styles from "./reward.css";
import { StepperField, type UnitKind } from "./StepperField";
import {
    type RewardFormValues,
    recalcCpaFromSplit,
    recalcSplitOnCpaChange,
    recommendedSplit,
    splitTargetCpa,
} from "./utils";

export function RecipientBox({
    control,
    name,
    label,
    unit,
    placeholder,
    hint,
    error,
    step,
    onChangeExtra,
}: {
    control: Control<RewardFormValues>;
    name:
        | "ambassadorAmount"
        | "refereeAmount"
        | "ambassadorPercent"
        | "refereePercent";
    label: string;
    unit: UnitKind;
    placeholder: string;
    /** Omitted (e.g. while the input is empty) ⇒ no hint line is rendered. */
    hint?: string;
    /** Tint the input red when the split is invalid. */
    error?: boolean;
    /** Native input `step` (e.g. `0.01` to allow 2-decimal entry). */
    step?: number | string;
    /** Runs after the field update (e.g. to re-derive the Target CPA). */
    onChangeExtra?: (next: number | "") => void;
}) {
    return (
        <div className={styles.recipientBox}>
            <Controller
                control={control}
                name={name}
                render={({ field }) => (
                    <StepperField
                        field={{
                            ...field,
                            onChange: (next) => {
                                field.onChange(next);
                                onChangeExtra?.(next as number | "");
                            },
                        }}
                        unit={unit}
                        tone="elevated"
                        error={error}
                        step={step}
                        placeholder={placeholder}
                        label={label}
                        hint={hint}
                    />
                )}
            />
        </div>
    );
}

// Cleared inputs become "" (not 0); coerce so the empty checks hold.
const num = (v: number | string | undefined) => (typeof v === "number" ? v : 0);

/**
 * Shared Target-CPA reveal for the Fixed (€) and % models: a Target CPA input,
 * an 80/20 distribution bar, a gated reco bar, and the Ambassador/Referee
 * split inputs. The unit (€ vs %) and field names are passed per model.
 */
export function CpaReveal({
    control,
    setValue,
    unit,
    cpaName,
    ambName,
    refName,
    cpaLabel,
    cpaPlaceholder,
    ambPlaceholder,
    refPlaceholder,
    recipientHint,
    hintWhenEmpty = false,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
    unit: "amount" | "percent";
    cpaName: "targetCpa" | "targetCpaPercent";
    ambName: "ambassadorAmount" | "ambassadorPercent";
    refName: "refereeAmount" | "refereePercent";
    cpaLabel: string;
    cpaPlaceholder: string;
    ambPlaceholder: string;
    refPlaceholder: string;
    /** Hint under each recipient input, given its share of the pool. */
    recipientHint: (poolPercent: number) => string;
    /** Show the hint even while the input is empty (the % model's static hint). */
    hintWhenEmpty?: boolean;
}) {
    const { t } = useTranslation();
    const cpa = num(useWatch({ control, name: cpaName }));
    const ambassador = num(useWatch({ control, name: ambName }));
    const referee = num(useWatch({ control, name: refName }));
    const { rewardsPool, frakCommission } = splitTargetCpa(cpa);
    const hasPool = rewardsPool > 0;
    const glyph = useCurrencyGlyph();
    const suffix = unit === "amount" ? glyph : "%";

    // Reco shows only while no split has been configured yet.
    const showReco = hasPool && ambassador === 0 && referee === 0;

    // The split must allocate the whole pool; flag any over/under allocation.
    const splitSum = ambassador + referee;
    const splitMismatch =
        hasPool && splitSum > 0 && Math.abs(splitSum - rewardsPool) >= 0.01;

    const poolPercent = (value: number) =>
        hasPool ? Math.round((value / rewardsPool) * 100) : 0;

    function applyReco() {
        const reco = recommendedSplit(cpa);
        setValue(ambName, reco.ambassador, { shouldValidate: true });
        setValue(refName, reco.referee, { shouldValidate: true });
    }

    // Editing a recipient reward makes the split the source of truth: re-derive
    // the Target CPA (pool ÷ rewards-share, to the cent) so the two stay in sync.
    function syncCpaFromSplit(nextAmbassador: number, nextReferee: number) {
        setValue(cpaName, recalcCpaFromSplit(nextAmbassador, nextReferee), {
            shouldValidate: true,
        });
    }

    return (
        <Stack space="m">
            <RevealHeader />

            <Controller
                control={control}
                name={cpaName}
                render={({ field }) => (
                    <StepperField
                        field={{
                            ...field,
                            // Changing the Target CPA changes the pool. If
                            // the split is still the untouched reco, keep it
                            // in sync by recomputing it for the new CPA. If
                            // the user edited the amounts, leave them — the
                            // mismatch warning + Continue gating flag it.
                            onChange: (next) => {
                                field.onChange(next);
                                const reco = recalcSplitOnCpaChange({
                                    prevCpa: cpa,
                                    nextCpa: num(next),
                                    ambassador,
                                    referee,
                                });
                                if (reco) {
                                    setValue(ambName, reco.ambassador, {
                                        shouldValidate: true,
                                    });
                                    setValue(refName, reco.referee, {
                                        shouldValidate: true,
                                    });
                                }
                            },
                        }}
                        unit={unit}
                        step={0.01}
                        placeholder={cpaPlaceholder}
                        label={cpaLabel}
                        hint={t("campaigns.create.reward.cpa.hint")}
                    />
                )}
            />

            <div className={styles.distributionGap}>
                <DistributionBar
                    rewardsLabel={t(
                        "campaigns.create.reward.cpa.rewardsDistributed"
                    )}
                    commissionLabel={t(
                        "campaigns.create.reward.cpa.frakCommission"
                    )}
                    rewardsAmount={rewardsPool}
                    commissionAmount={frakCommission}
                    suffix={suffix}
                />
            </div>

            {showReco && <RecoBar onApply={applyReco} />}

            {hasPool && (
                <div className={styles.recipientGrid}>
                    <RecipientBox
                        control={control}
                        name={ambName}
                        label={t(
                            "campaigns.create.reward.recipient.ambassadorReward"
                        )}
                        unit={unit}
                        step={0.01}
                        placeholder={ambPlaceholder}
                        error={splitMismatch}
                        onChangeExtra={(next) =>
                            syncCpaFromSplit(num(next), referee)
                        }
                        hint={
                            hintWhenEmpty || ambassador > 0
                                ? recipientHint(poolPercent(ambassador))
                                : undefined
                        }
                    />
                    <RecipientBox
                        control={control}
                        name={refName}
                        label={t(
                            "campaigns.create.reward.recipient.refereeReward"
                        )}
                        unit={unit}
                        step={0.01}
                        placeholder={refPlaceholder}
                        error={splitMismatch}
                        onChangeExtra={(next) =>
                            syncCpaFromSplit(ambassador, num(next))
                        }
                        hint={
                            hintWhenEmpty || referee > 0
                                ? recipientHint(poolPercent(referee))
                                : undefined
                        }
                    />
                </div>
            )}

            {splitMismatch && (
                <FieldError>
                    {t("campaigns.create.reward.cpa.splitMismatch", {
                        amount: `${rewardsPool}${suffix}`,
                    })}
                </FieldError>
            )}

            <TriggeredRow />
        </Stack>
    );
}

export function FixedReveal({
    control,
    setValue,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <CpaReveal
            control={control}
            setValue={setValue}
            unit="amount"
            cpaName="targetCpa"
            ambName="ambassadorAmount"
            refName="refereeAmount"
            cpaLabel={t("campaigns.create.reward.fixed.cpaLabel")}
            cpaPlaceholder={t("campaigns.create.reward.fixed.cpaPlaceholder")}
            ambPlaceholder={t(
                "campaigns.create.reward.recipient.ambassadorPlaceholder"
            )}
            refPlaceholder={t(
                "campaigns.create.reward.recipient.refereePlaceholder"
            )}
            recipientHint={(percent) =>
                t("campaigns.create.reward.fixed.percentOfPool", { percent })
            }
        />
    );
}

export function PercentageReveal({
    control,
    setValue,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <CpaReveal
            control={control}
            setValue={setValue}
            unit="percent"
            cpaName="targetCpaPercent"
            ambName="ambassadorPercent"
            refName="refereePercent"
            cpaLabel={t("campaigns.create.reward.percentage.cpaLabel")}
            cpaPlaceholder={t(
                "campaigns.create.reward.percentage.cpaPlaceholder"
            )}
            ambPlaceholder={t(
                "campaigns.create.reward.recipient.ambassadorPlaceholder"
            )}
            refPlaceholder={t(
                "campaigns.create.reward.recipient.refereePlaceholder"
            )}
            recipientHint={() =>
                t("campaigns.create.reward.percentage.recipientHint")
            }
            hintWhenEmpty
        />
    );
}
