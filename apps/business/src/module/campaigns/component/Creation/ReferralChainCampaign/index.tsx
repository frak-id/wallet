import { Column } from "@frak-labs/design-system/components/Column";
import { Columns } from "@frak-labs/design-system/components/Columns";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { LegendItem } from "@frak-labs/design-system/components/LegendItem";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@frak-labs/design-system/components/Table";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, PercentIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { Fragment, useMemo } from "react";
import { type Control, Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useCampaignCurrencyGlyph } from "@/module/campaigns/hook/useCampaignCurrencyGlyph";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { Input } from "@/module/forms/Input";
import { InputNumber } from "@/module/forms/InputNumber";
import { campaignStore } from "@/stores/campaignStore";
import { InfoBanner } from "../InfoBanner";
import { draftToRewardForm } from "../RewardCampaign/utils";
import { WizardFieldCard } from "../WizardFieldCard";
import { WizardStep } from "../WizardStep";
import * as styles from "./referralChain.css";
import {
    computeChainPreview,
    DEFAULT_PREVIEW_DEPTH,
    DEFAULT_REFERRAL_CHAIN_FORM,
    draftToReferralChainForm,
    hasReferrerReward,
    isReferralChainFormValid,
    MAX_REWARDED_LEVELS,
    MIN_DEPERDITION_PER_LEVEL,
    type ReferralChainFormValues,
    referralChainFormToDraft,
} from "./utils";

const FORM_ID = "campaign-referral-chain-form";

/* ---- Fields ---- */

/** Numeric field: label above, hint below. */
function LabeledNumberField({
    control,
    name,
    label,
    hint,
    placeholder,
    rightSection,
    min,
    max,
}: {
    control: Control<ReferralChainFormValues>;
    name: "deperditionPerLevel" | "maxDepth";
    label: string;
    hint: string;
    placeholder: string;
    rightSection?: React.ReactNode;
    min?: number;
    max?: number;
}) {
    return (
        <Stack space="xs" className={styles.field}>
            <span className={styles.fieldLabel}>
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {label}
                </Text>
            </span>
            <Controller
                control={control}
                name={name}
                render={({ field }) => (
                    <InputNumber
                        variant="bare"
                        tone="muted"
                        aria-label={label}
                        classNameWrapper={styles.inputWrapper}
                        placeholder={placeholder}
                        rightSection={rightSection}
                        min={min}
                        max={max}
                        {...field}
                        value={field.value ?? ""}
                    />
                )}
            />
            <Text variant="caption" color="tertiary" className={styles.insetX}>
                {hint}
            </Text>
        </Stack>
    );
}

/* ---- Live preview (backend-aligned conserved split) ---- */

function rowLabel(t: TFunction, level: number) {
    return level === 0
        ? t("campaigns.create.referralChain.preview.direct")
        : t("campaigns.create.referralChain.preview.level", { n: level });
}

/** Connector between chain cards: dot + 36px line + head. */
function ChainArrow({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            width={6}
            height={39}
            viewBox="0 0 6 39"
            fill="none"
            aria-hidden="true"
        >
            <path
                d="M2.88672 5.33329C4.35948 5.33329 5.55339 4.13939 5.55339 2.66663C5.55339 1.19387 4.35948 -4.18973e-05 2.88672 -4.19617e-05C1.41396 -4.2026e-05 0.220054 1.19387 0.220054 2.66663C0.220054 4.13939 1.41396 5.33329 2.88672 5.33329ZM2.88672 38.6666L5.77347 33.6666L-3.24448e-05 33.6666L2.88672 38.6666ZM2.88672 2.66663L2.38672 2.66663L2.38672 34.1666L2.88672 34.1666L3.38672 34.1666L3.38672 2.66663L2.88672 2.66663Z"
                fill="currentColor"
            />
        </svg>
    );
}

/** Short table labels (no "ambassador"): `Direct` / `Level N`. */
function tableRowLabel(t: TFunction, level: number) {
    return level === 0
        ? t("campaigns.create.referralChain.preview.rowDirect")
        : t("campaigns.create.referralChain.preview.rowLevel", { n: level });
}

function ChainPreview({
    control,
    base,
    glyph,
}: {
    control: Control<ReferralChainFormValues>;
    /** Referrer reward; `undefined` for %/tiered models. */
    base: number | undefined;
    glyph: string;
}) {
    const { t } = useTranslation();
    const decrease = Number(useWatch({ control, name: "deperditionPerLevel" }));
    const maxDepthRaw = useWatch({ control, name: "maxDepth" });

    const inRange = decrease >= MIN_DEPERDITION_PER_LEVEL && decrease < 100;
    // Outside [50,100) the distribution is broken (below 50% deeper levels
    // out-earn the direct referrer; at 100% they get nothing), so warn instead
    // of rendering a misleading preview.
    if (decrease > 0 && !inRange) {
        return (
            <InfoBanner>
                {t("campaigns.create.referralChain.decrease.outOfRange")}
            </InfoBanner>
        );
    }
    if (!inRange) return null;

    const depth = Math.min(
        Number(maxDepthRaw) || DEFAULT_PREVIEW_DEPTH,
        MAX_REWARDED_LEVELS
    );
    const rows = computeChainPreview(base ?? 0, decrease, depth);
    const hasAmounts = base !== undefined;
    const value = (amount: number, share: number) =>
        hasAmounts ? `${amount.toFixed(2)} ${glyph}` : `${share}%`;

    const directShare = rows[0]?.share ?? 0;
    const chainShare = 100 - directShare;

    return (
        <Stack space="m">
            <div className={styles.schemaBox}>
                <Text
                    variant="body"
                    weight="medium"
                    className={styles.schemaHeader}
                >
                    {t("campaigns.create.referralChain.preview.title")}
                </Text>
                <Stack space="none" align="center">
                    <div className={styles.purchaseCard}>
                        <Inline space="xs" alignY="center">
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                className={styles.successText}
                            >
                                {t(
                                    "campaigns.create.referralChain.preview.purchase"
                                )}
                            </Text>
                            <CheckIcon
                                width={24}
                                height={24}
                                className={styles.successText}
                            />
                        </Inline>
                    </div>
                    {rows.map((row) => {
                        const isDirect = row.level === 0;
                        return (
                            <Fragment key={row.level}>
                                <ChainArrow
                                    className={
                                        isDirect
                                            ? styles.arrowSuccess
                                            : styles.arrowWarning
                                    }
                                />
                                <div
                                    className={
                                        isDirect
                                            ? styles.cardSuccess
                                            : styles.cardWarning
                                    }
                                >
                                    <Text
                                        variant="bodySmall"
                                        weight="medium"
                                        color="secondary"
                                    >
                                        {rowLabel(t, row.level)}
                                    </Text>
                                    <Text
                                        variant="caption"
                                        weight="medium"
                                        className={
                                            isDirect
                                                ? styles.successText
                                                : styles.warningText
                                        }
                                    >
                                        {value(row.amount, row.share)}
                                    </Text>
                                </div>
                            </Fragment>
                        );
                    })}
                </Stack>
                <Text
                    variant="caption"
                    color="secondary"
                    className={styles.schemaHeader}
                >
                    {t("campaigns.create.referralChain.preview.caption", {
                        percent: decrease,
                    })}
                </Text>
            </div>

            <Stack space="s" className={styles.legendGroup}>
                <div className={styles.splitBar}>
                    <span
                        className={styles.splitSuccess}
                        style={{ width: `${directShare}%` }}
                    />
                    <span
                        className={styles.splitWarning}
                        style={{ width: `${chainShare}%` }}
                    />
                </div>
                <Inline space="xl" alignY="center">
                    <LegendItem swatchColor={vars.text.success}>
                        {t(
                            "campaigns.create.referralChain.preview.directReward"
                        )}
                    </LegendItem>
                    <LegendItem swatchColor={vars.text.warning}>
                        {t(
                            "campaigns.create.referralChain.preview.chainReward"
                        )}
                    </LegendItem>
                </Inline>
            </Stack>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>
                            {t(
                                "campaigns.create.referralChain.preview.tableLevel"
                            )}
                        </TableHead>
                        <TableHead align="right">
                            {t(
                                "campaigns.create.referralChain.preview.tableAmount"
                            )}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rows.map((row) => (
                        <TableRow key={row.level}>
                            <TableCell>{tableRowLabel(t, row.level)}</TableCell>
                            <TableCell align="right">
                                <span
                                    className={
                                        row.level === 0
                                            ? styles.amountSuccess
                                            : styles.amountWarning
                                    }
                                >
                                    {value(row.amount, row.share)}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </Stack>
    );
}

export function ReferralChainCampaign() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((s) => s.draft);
    const updateDraft = campaignStore((s) => s.updateDraft);
    const saveCampaign = useSaveCampaign();
    const glyph = useCampaignCurrencyGlyph();

    const defaultValues = useMemo(
        () => draftToReferralChainForm(draft),
        [draft]
    );
    const form = useForm<ReferralChainFormValues>({
        values: defaultValues,
        mode: "onChange",
    });

    const enabled = useWatch({ control: form.control, name: "enabled" });
    const watched = useWatch({ control: form.control });
    const isValid = isReferralChainFormValid(
        {
            ...DEFAULT_REFERRAL_CHAIN_FORM,
            ...watched,
        } as ReferralChainFormValues,
        draft
    );

    const hasReferrer = hasReferrerReward(draft);
    // Both the preview base (ambassador reward) and the CAC come from the
    // reward step's form — derive them from a single parse.
    const rewardForm = draftToRewardForm(draft);
    const isFixed = rewardForm.model === "fixed";
    const rewardBase = isFixed ? rewardForm.ambassadorAmount : undefined;
    const cac = isFixed ? rewardForm.targetCpa || undefined : undefined;

    async function persist(values: ReferralChainFormValues) {
        const updated = referralChainFormToDraft(values, {
            ...draft,
            merchantId,
        });
        updateDraft(() => updated);
        return saveCampaign.mutateAsync(updated);
    }

    async function onSubmit(values: ReferralChainFormValues) {
        const saved = await persist(values);
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/validation",
            params: { merchantId, campaignId: saved.id },
        });
    }

    const handleSaveDraft = form.handleSubmit(persist);

    return (
        <WizardStep
            stepKey="referralChain"
            formId={FORM_ID}
            isValid={isValid}
            isPending={saveCampaign.isPending}
            onSaveDraft={handleSaveDraft}
            onClose={() => form.reset(defaultValues)}
        >
            <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                <Stack space="l">
                    <Inline
                        space="m"
                        padding="m"
                        align="space-between"
                        alignY="top"
                        fill
                        className={styles.toggleCell}
                    >
                        <Stack space="xxs" className={styles.toggleMain}>
                            <Text variant="body" weight="medium">
                                {t(
                                    "campaigns.create.referralChain.enable.title"
                                )}
                            </Text>
                            <Text variant="bodySmall" color="secondary">
                                {t(
                                    "campaigns.create.referralChain.enable.description"
                                )}
                            </Text>
                        </Stack>
                        <Controller
                            control={form.control}
                            name="enabled"
                            render={({ field }) => (
                                <Switch
                                    checked={field.value ?? false}
                                    onCheckedChange={field.onChange}
                                    disabled={!hasReferrer}
                                />
                            )}
                        />
                    </Inline>

                    {!hasReferrer && (
                        <InfoBanner>
                            {t("campaigns.create.referralChain.noReferrer")}
                        </InfoBanner>
                    )}

                    {enabled && hasReferrer && (
                        <WizardFieldCard
                            space="m"
                            label={t(
                                "campaigns.create.referralChain.model.label"
                            )}
                            description={t(
                                "campaigns.create.referralChain.model.description"
                            )}
                        >
                            <Stack space="m">
                                <Columns space="m" alignY="top">
                                    <Column width="1/2">
                                        <LabeledNumberField
                                            control={form.control}
                                            name="deperditionPerLevel"
                                            label={t(
                                                "campaigns.create.referralChain.decrease.label"
                                            )}
                                            hint={t(
                                                "campaigns.create.referralChain.decrease.hint"
                                            )}
                                            placeholder={t(
                                                "campaigns.create.referralChain.decrease.placeholder"
                                            )}
                                            min={MIN_DEPERDITION_PER_LEVEL}
                                            rightSection={
                                                <PercentIcon
                                                    width={24}
                                                    height={24}
                                                    className={styles.unitIcon}
                                                />
                                            }
                                        />
                                    </Column>
                                    <Column width="1/2">
                                        <LabeledNumberField
                                            control={form.control}
                                            name="maxDepth"
                                            label={t(
                                                "campaigns.create.referralChain.maxLevels.label"
                                            )}
                                            hint={t(
                                                "campaigns.create.referralChain.maxLevels.hint"
                                            )}
                                            placeholder={t(
                                                "campaigns.create.referralChain.maxLevels.placeholder"
                                            )}
                                            max={MAX_REWARDED_LEVELS}
                                        />
                                    </Column>
                                </Columns>

                                <Stack space="xs">
                                    <Text
                                        variant="bodySmall"
                                        weight="medium"
                                        color="secondary"
                                        className={styles.insetX}
                                    >
                                        {t(
                                            "campaigns.create.referralChain.cac.label"
                                        )}
                                    </Text>
                                    <Input
                                        variant="bare"
                                        tone="muted"
                                        readOnly
                                        disabled
                                        aria-label={t(
                                            "campaigns.create.referralChain.cac.label"
                                        )}
                                        value={
                                            cac !== undefined ? String(cac) : ""
                                        }
                                        rightSection={
                                            <span className={styles.unitGlyph}>
                                                {glyph}
                                            </span>
                                        }
                                    />
                                </Stack>

                                <ChainPreview
                                    control={form.control}
                                    base={rewardBase}
                                    glyph={glyph}
                                />
                            </Stack>
                        </WizardFieldCard>
                    )}
                </Stack>
            </form>
        </WizardStep>
    );
}
