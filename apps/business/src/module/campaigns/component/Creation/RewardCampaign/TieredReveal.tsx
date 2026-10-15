import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { PlusIcon } from "@frak-labs/design-system/icons";
import { Fragment } from "react";
import {
    type Control,
    type UseFormSetValue,
    useFieldArray,
    useFormState,
    useWatch,
} from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { DistributionBar } from "../DistributionBar";
import { useCurrencyGlyph } from "./currencyGlyph";
import { RecoBar, RevealHeader, TriggeredRow } from "./RevealParts";
import * as styles from "./reward.css";
import type { UnitKind } from "./StepperField";
import { TierCard } from "./TierCard";
import {
    type CpaTierRow,
    type RewardFormValues,
    recalcCpaFromSplit,
    recalcSplitOnCpaChange,
    recommendedSplit,
    splitTargetCpa,
    tieredRangesOverlap,
} from "./utils";

export function TieredReveal({
    control,
    setValue,
}: {
    control: Control<RewardFormValues>;
    setValue: UseFormSetValue<RewardFormValues>;
}) {
    const { t } = useTranslation();
    const glyph = useCurrencyGlyph();
    // One field array per tiered column; appended/removed together so they stay
    // index-aligned (Global CPA holds the range/unit, recipients hold rewards).
    const globalArray = useFieldArray({ control, name: "globalCpaTiers" });
    const ambassadorArray = useFieldArray({ control, name: "ambassadorTiers" });
    const refereeArray = useFieldArray({ control, name: "refereeTiers" });

    const tiers = (useWatch({ control, name: "globalCpaTiers" }) ??
        []) as CpaTierRow[];
    // The per-tier reward amounts, watched so a CPA change can tell an untouched
    // reco (track the new CPA) apart from a user-edited split (leave it).
    const ambTiers = (useWatch({ control, name: "ambassadorTiers" }) ?? []) as {
        reward: number | "";
    }[];
    const refTiers = (useWatch({ control, name: "refereeTiers" }) ?? []) as {
        reward: number | "";
    }[];
    // Errors are gated per-field on touch (blur): a field reds only once the user
    // has left it empty, so filling one input never reds its still-pristine
    // neighbours (and a just-added tier stays clean).
    const { touchedFields } = useFormState({ control });
    const touched = touchedFields.globalCpaTiers;
    const fieldErrors = (
        i: number,
        tier: CpaTierRow | undefined,
        isLast: boolean
    ) => {
        const tf = touched?.[i];
        return {
            from: Boolean(tf?.from) && (!tier || tier.from === ""),
            to: Boolean(tf?.to) && !isLast && (!tier || tier.to === ""),
            cpa: Boolean(tf?.cpa) && !(Number(tier?.cpa) > 0),
        };
    };
    const lastIndex = tiers.length - 1;
    // The summary surfaces only alongside an actually-red field, never alone.
    const incomplete = tiers.some((tier, i) => {
        const e = fieldErrors(i, tier, i === lastIndex);
        return e.from || e.to || e.cpa;
    });
    const tiersOverlap = tieredRangesOverlap(tiers);
    const hasCpa = tiers.some((tier) => Number(tier.cpa) > 0);

    function addTier() {
        // Chain ranges gaplessly: new tier starts at the previous max. Bounds
        // are inclusive and the backend resolves the shared boundary to the
        // upper tier (sorted by minValue desc), so no basket value falls
        // through — unlike a +1 step, which would skip fractional baskets.
        const prevTo = tiers.at(-1)?.to;
        const from = typeof prevTo === "number" ? prevTo : "";
        globalArray.append({ from, to: "", cpa: "", unit: "percent" });
        ambassadorArray.append({ reward: "" });
        refereeArray.append({ reward: "" });
    }
    function removeTier(index: number) {
        globalArray.remove(index);
        ambassadorArray.remove(index);
        refereeArray.remove(index);
    }
    // Mirror the Fixed/% reveal: when a tier's Target CPA changes and its split
    // is still the untouched reco, recompute it for the new CPA (a user-edited
    // split is left as-is). Shared via `recalcSplitOnCpaChange`.
    function handleCpaChange(index: number, next: number | "") {
        const reco = recalcSplitOnCpaChange({
            prevCpa: Number(tiers[index]?.cpa) || 0,
            nextCpa: Number(next) || 0,
            ambassador: Number(ambTiers[index]?.reward) || 0,
            referee: Number(refTiers[index]?.reward) || 0,
        });
        if (!reco) return;
        setValue(`ambassadorTiers.${index}.reward`, reco.ambassador, {
            shouldValidate: true,
            shouldDirty: true,
        });
        setValue(`refereeTiers.${index}.reward`, reco.referee, {
            shouldValidate: true,
            shouldDirty: true,
        });
    }
    // Reverse of `handleCpaChange`: editing a recipient reward makes the split
    // the source of truth, so re-derive that tier's Target CPA (pool ÷
    // rewards-share, to the cent) — mirroring the Fixed/% reveal.
    function handleRewardChange(
        index: number,
        recipient: "ambassador" | "referee",
        next: number | ""
    ) {
        const ambassador =
            recipient === "ambassador"
                ? Number(next) || 0
                : Number(ambTiers[index]?.reward) || 0;
        const referee =
            recipient === "referee"
                ? Number(next) || 0
                : Number(refTiers[index]?.reward) || 0;
        setValue(
            `globalCpaTiers.${index}.cpa`,
            recalcCpaFromSplit(ambassador, referee),
            { shouldValidate: true, shouldDirty: true }
        );
    }
    // Fill the recommended 80/20 split per tier; the distribution bar always
    // shows that ratio, but the amounts stay the user's to override. Written via
    // `setValue` (not the field array's `replace`) so it reaches the recipient
    // inputs, which are registered by name rather than mapped from `fields`.
    function applyReco() {
        tiers.forEach((g, i) => {
            const { ambassador, referee } = recommendedSplit(
                Number(g.cpa) || 0
            );
            setValue(`ambassadorTiers.${i}.reward`, ambassador, {
                shouldValidate: true,
                shouldDirty: true,
            });
            setValue(`refereeTiers.${i}.reward`, referee, {
                shouldValidate: true,
                shouldDirty: true,
            });
        });
    }

    return (
        <Stack space="m">
            <RevealHeader />

            {globalArray.fields.map((row, index) => {
                const tier = tiers[index];
                const isLast = index === globalArray.fields.length - 1;
                const unit = (tier?.unit ?? "amount") as UnitKind;
                const errors = fieldErrors(index, tier, isLast);
                const { rewardsPool, frakCommission } = splitTargetCpa(
                    Number(tier?.cpa) || 0
                );
                return (
                    <Fragment key={row.id}>
                        <TierCard
                            control={control}
                            index={index}
                            isLast={isLast}
                            unit={unit}
                            fromError={errors.from}
                            toError={errors.to}
                            cpaError={errors.cpa}
                            onRemove={() => removeTier(index)}
                            onCpaChange={(next) => handleCpaChange(index, next)}
                            onRewardChange={(recipient, next) =>
                                handleRewardChange(index, recipient, next)
                            }
                        />
                        <div className={styles.tierDistribution}>
                            <DistributionBar
                                rewardsLabel={t(
                                    "campaigns.create.reward.cpa.rewardsDistributed"
                                )}
                                commissionLabel={t(
                                    "campaigns.create.reward.cpa.frakCommission"
                                )}
                                rewardsAmount={rewardsPool}
                                commissionAmount={frakCommission}
                                suffix={unit === "amount" ? glyph : "%"}
                            />
                        </div>
                    </Fragment>
                );
            })}

            {/* The reco sits below the tiers and surfaces only once a Target
                CPA exists; applying it fills every tier's 80/20 split. */}
            {hasCpa && <RecoBar onApply={applyReco} />}

            <Inline space="none">
                <Button
                    type="button"
                    variant="primary"
                    size="small"
                    rightIcon={<PlusIcon width={16} height={16} />}
                    onClick={addTier}
                >
                    {t("campaigns.create.reward.tiered.addTier")}
                </Button>
            </Inline>

            {incomplete ? (
                <FieldError>
                    {t("campaigns.create.reward.tiered.incomplete")}
                </FieldError>
            ) : tiersOverlap ? (
                <FieldError>
                    {t("campaigns.create.reward.tiered.overlap")}
                </FieldError>
            ) : null}

            <TriggeredRow />
        </Stack>
    );
}
