import { Notice } from "@frak-labs/design-system/components/Notice";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import { InputNumber } from "@/module/forms/InputNumber";
import * as customize from "../customize.css";
import { SegmentedTabs, type SegmentedTabsProps } from "../SegmentedTabs";
import {
    applyLook,
    DEFAULT_SIZE,
    fontSizeFor,
    LOOKS,
    type Look,
    type LookChoice,
    matchLook,
    SIZE_STEPS,
    type SizeStep,
} from "../style/presets";
import {
    DEFAULT_TIER,
    normalizeStyleValues,
    serializeStyleCss,
} from "../style/styleCodec";
import * as styles from "../styleControls.css";
import type {
    ButtonShareStyleFormValues,
    ButtonShareStyleValues,
    ComponentSettingsFormValues,
    FontWeight,
    StyleTier,
} from "../types";
import { FONT_WEIGHTS } from "../types";
import { BoxModelControl } from "./BoxModelControl";
import { ColorRow } from "./ColorRow";

const STYLE_FIELD = "buttonShare.style" as const;

const SIZE_LIMITS = { bw: 12, fs: 48 } as const;

type SizeName = "bw" | "fs";

// Radix needs a concrete value per item, so "inherit" gets its own token
// rather than the empty string.
const WEIGHT_INHERIT = "theme";

const LOOK_OPTIONS: readonly LookChoice[] = [...LOOKS, "custom"];

// Every key present and defined: react-hook-form walks only the keys it is
// given, and skips re-rendering a field it sets to undefined.
const CLEARED_STYLE: ButtonShareStyleFormValues = {
    bg: "",
    fg: "",
    bc: "",
    bw: "",
    fs: "",
    fw: "",
    py: "",
    px: "",
    pu: "",
    mt: "",
    mb: "",
    ml: "",
    mr: "",
    mu: "",
};

function coerceSize(value: unknown, max: number): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    return Math.min(max, Math.max(0, Math.round(value)));
}

function SizeRow({
    form,
    name,
    label,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    name: SizeName;
    label: string;
}) {
    return (
        <FormField
            control={form.control}
            name={`${STYLE_FIELD}.${name}`}
            render={({ field }) => (
                <EditField label={label}>
                    <FormControl>
                        <InputNumber
                            {...field}
                            variant="bare"
                            tone="muted"
                            min={0}
                            max={SIZE_LIMITS[name]}
                            value={field.value ?? ""}
                            data-testid={`buttonShare.style.${name}-input`}
                            onBlur={() => {
                                field.onChange(
                                    coerceSize(field.value, SIZE_LIMITS[name])
                                );
                                field.onBlur();
                            }}
                        />
                    </FormControl>
                </EditField>
            )}
        />
    );
}

function WeightRow({
    form,
    label,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    label: string;
}) {
    const { t } = useTranslation();

    return (
        <FormField
            control={form.control}
            name={`${STYLE_FIELD}.fw`}
            render={({ field }) => (
                <EditField label={label}>
                    <Select
                        value={
                            field.value ? String(field.value) : WEIGHT_INHERIT
                        }
                        onValueChange={(next) =>
                            field.onChange(
                                next === WEIGHT_INHERIT
                                    ? undefined
                                    : (Number(next) as FontWeight)
                            )
                        }
                    >
                        <FormControl>
                            <SelectTrigger
                                ref={field.ref}
                                variant="bare"
                                tone="muted"
                                data-testid="buttonShare.style.fw-select"
                            >
                                <SelectValue />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value={WEIGHT_INHERIT}>
                                {t("customize.components.style.weight_theme")}
                            </SelectItem>
                            {FONT_WEIGHTS.map((weight) => (
                                <SelectItem
                                    key={weight}
                                    value={String(weight)}
                                    data-testid={`buttonShare.style.fw-${weight}`}
                                >
                                    {t(
                                        `customize.components.style.weight_${weight}`
                                    )}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </EditField>
            )}
        />
    );
}

function ControlRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <Stack space="xxs">
            <Text variant="caption" color="tertiary">
                {label}
            </Text>
            {children}
        </Stack>
    );
}

function SegmentedChoice<T extends string>({
    label,
    ...tabs
}: { label: string } & SegmentedTabsProps<T>) {
    return (
        <ControlRow label={label}>
            <SegmentedTabs {...tabs} />
        </ControlRow>
    );
}

/**
 * Visual controls for the share button. A preset drives the colour and border
 * signature, the box model owns spacing, and everything compiles into the
 * component's existing `rawCss` — nothing here exposes CSS to the merchant.
 */
export function ButtonShareStyleFields({
    form,
    tier,
    previewLabel,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    tier: StyleTier;
    previewLabel: string;
}) {
    const { t } = useTranslation();

    // The form also holds "" for an emptied control, so every read is
    // normalized before it reaches the controls that expect real values.
    const values = normalizeStyleValues(form.watch(STYLE_FIELD));
    const { look, size, accent } = matchLook(values);

    const write = (next: ButtonShareStyleValues | ButtonShareStyleFormValues) =>
        form.setValue(STYLE_FIELD, next, { shouldDirty: true });

    const patch = (next: Partial<ButtonShareStyleValues>) =>
        write({ ...values, ...next });

    // A hand-set text size survives a look change; picking "theme" still
    // clears everything, since that look means "inherit".
    const selectLook = (next: Look) => {
        const step = size === "custom" ? DEFAULT_SIZE : size;
        const applied = applyLook(values, next, step, accent);
        const keepsFs =
            next !== "theme" && size === "custom" && values.fs !== undefined;
        write(keepsFs ? { ...applied, fs: values.fs } : applied);
    };

    const selectSize = (next: SizeStep) =>
        write(
            look === "theme" || look === "custom"
                ? { ...values, fs: fontSizeFor(next) }
                : applyLook(values, look, next, accent)
        );

    const lookOptions = look === "custom" ? LOOK_OPTIONS : LOOKS;
    // Registered-but-empty fields leave keys behind, so "has a style" means
    // "the codec would emit something", not "the object is non-empty".
    const isStyled = serializeStyleCss(values, "", tier) !== undefined;

    return (
        <Stack space="s">
            <div className={customize.styleHeader}>
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {t("customize.components.style.title")}
                </Text>
                <button
                    type="button"
                    className={customize.styleGhostButton}
                    disabled={!isStyled}
                    data-testid="buttonShare.style.clear-all"
                    onClick={() => write(CLEARED_STYLE)}
                >
                    {t("customize.components.style.clearAll")}
                </button>
            </div>

            <Notice tone="info">
                <Text variant="caption">
                    {t("customize.components.style.inheritNotice")}
                </Text>
            </Notice>

            <SegmentedChoice
                label={t("customize.components.style.look")}
                value={look}
                options={lookOptions}
                labelFor={(option) =>
                    t(`customize.components.style.look_${option}`)
                }
                onSelect={(option) => option !== "custom" && selectLook(option)}
                testId="style-look"
            />

            {look !== "theme" && (
                <SegmentedChoice
                    label={t("customize.components.style.size")}
                    value={size}
                    options={SIZE_STEPS}
                    labelFor={(option) =>
                        t(`customize.components.style.size_${option}`)
                    }
                    onSelect={selectSize}
                    testId="style-size"
                />
            )}

            <ControlRow label={t("customize.components.style.spacing")}>
                <Stack space="s">
                    <BoxModelControl
                        values={values}
                        onChange={patch}
                        previewLabel={previewLabel}
                        tier={tier}
                    />
                    <div className={styles.halfWidthRow}>
                        <SizeRow
                            form={form}
                            name="fs"
                            label={t("customize.components.style.textSize")}
                        />
                        <WeightRow
                            form={form}
                            label={t("customize.components.style.textWeight")}
                        />
                    </div>
                </Stack>
            </ControlRow>

            <ControlRow label={t("customize.components.style.groupColors")}>
                <div className={customize.settingsGrid}>
                    <ColorRow
                        form={form}
                        name="buttonShare.style.bg"
                        label={t("customize.components.style.background")}
                        allowTransparent
                    />
                    <ColorRow
                        form={form}
                        name="buttonShare.style.fg"
                        label={t("customize.components.style.textColor")}
                    />
                    <ColorRow
                        form={form}
                        name="buttonShare.style.bc"
                        label={t("customize.components.style.borderColor")}
                    />
                    <SizeRow
                        form={form}
                        name="bw"
                        label={t("customize.components.style.borderWidth")}
                    />
                </div>
            </ControlRow>

            {tier === DEFAULT_TIER && (
                <Text variant="caption" color="tertiary">
                    {t("customize.components.style.defaultTierHint")}
                </Text>
            )}
        </Stack>
    );
}
