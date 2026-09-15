import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import { InputNumber } from "@/module/forms/InputNumber";
import * as styles from "../customize.css";
import { DEFAULT_TIER, isHexColor, TRANSPARENT } from "../style/styleCodec";
import type { ComponentSettingsFormValues, StyleTier } from "../types";

type ColorName = `buttonShare.style.${"bg" | "fg" | "bc"}`;
type SizeName = `buttonShare.style.${
    | "bw"
    | "fs"
    | "py"
    | "px"
    | "mt"
    | "mb"
    | "ml"
    | "mr"}`;

const SWATCH_FALLBACK = "#000000";

/** Keeps an out-of-range entry from reaching storage without failing the save. */
function coerceSize(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
    return Math.max(0, Math.round(value));
}

function ColorRow({
    form,
    name,
    label,
    allowTransparent = false,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    name: ColorName;
    label: string;
    allowTransparent?: boolean;
}) {
    const { t } = useTranslation();
    const lastValid = useRef("");

    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => {
                const raw = typeof field.value === "string" ? field.value : "";
                const isNone = raw === TRANSPARENT;
                const swatch = isHexColor(raw) ? raw : SWATCH_FALLBACK;

                // Tracks the rendered value, not just typed input: switching
                // placement re-syncs the form without remounting this row.
                if (isHexColor(raw)) lastValid.current = raw;

                const commit = (next: string) => field.onChange(next);

                return (
                    <EditField label={label}>
                        <div className={styles.colorRow}>
                            <FormControl className={styles.colorField}>
                                <Input
                                    variant="bare"
                                    tone="muted"
                                    placeholder={SWATCH_FALLBACK}
                                    name={field.name}
                                    ref={field.ref}
                                    disabled={isNone}
                                    value={isNone ? "" : raw}
                                    data-testid={`${name}-hex`}
                                    onChange={(event) =>
                                        commit(event.target.value)
                                    }
                                    onBlur={() => {
                                        if (!isNone && !isHexColor(raw)) {
                                            field.onChange(lastValid.current);
                                        }
                                        field.onBlur();
                                    }}
                                />
                            </FormControl>
                            <div className={styles.colorActions}>
                                <input
                                    type="color"
                                    className={styles.colorSwatch}
                                    aria-label={t(
                                        "customize.components.style.swatchLabel",
                                        { label }
                                    )}
                                    disabled={isNone}
                                    value={swatch}
                                    data-testid={`${name}-swatch`}
                                    onChange={(event) =>
                                        commit(event.target.value)
                                    }
                                />
                                <button
                                    type="button"
                                    className={styles.styleGhostButton}
                                    data-testid={`${name}-clear`}
                                    onClick={() => field.onChange("")}
                                >
                                    {t("customize.components.style.clear")}
                                </button>
                                {allowTransparent && (
                                    <button
                                        type="button"
                                        aria-pressed={isNone}
                                        className={styles.styleGhostButton}
                                        data-testid={`${name}-none`}
                                        onClick={() =>
                                            field.onChange(
                                                isNone ? "" : TRANSPARENT
                                            )
                                        }
                                    >
                                        {t("customize.components.style.none")}
                                    </button>
                                )}
                            </div>
                        </div>
                    </EditField>
                );
            }}
        />
    );
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
            name={name}
            render={({ field }) => (
                <EditField label={label}>
                    <FormControl>
                        <InputNumber
                            {...field}
                            variant="bare"
                            tone="muted"
                            min={0}
                            value={field.value ?? ""}
                            data-testid={`${name}-input`}
                            onBlur={() => {
                                field.onChange(coerceSize(field.value));
                                field.onBlur();
                            }}
                        />
                    </FormControl>
                </EditField>
            )}
        />
    );
}

function StyleGroup({
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
            <div className={styles.settingsGrid}>{children}</div>
        </Stack>
    );
}

/**
 * Visual controls for the share button. Values compile into the component's
 * existing `rawCss`, so nothing here exposes CSS to the merchant.
 */
export function ButtonShareStyleFields({
    form,
    tier,
}: {
    form: UseFormReturn<ComponentSettingsFormValues>;
    tier: StyleTier;
}) {
    const { t } = useTranslation();

    return (
        <Stack space="s">
            <Text variant="bodySmall" weight="medium" color="secondary">
                {t("customize.components.style.title")}
            </Text>
            <StyleGroup label={t("customize.components.style.groupText")}>
                <ColorRow
                    form={form}
                    name="buttonShare.style.fg"
                    label={t("customize.components.style.textColor")}
                />
                <SizeRow
                    form={form}
                    name="buttonShare.style.fs"
                    label={t("customize.components.style.textSize")}
                />
            </StyleGroup>
            <StyleGroup label={t("customize.components.style.groupSurface")}>
                <ColorRow
                    form={form}
                    name="buttonShare.style.bg"
                    label={t("customize.components.style.background")}
                    allowTransparent
                />
                <ColorRow
                    form={form}
                    name="buttonShare.style.bc"
                    label={t("customize.components.style.borderColor")}
                />
                <SizeRow
                    form={form}
                    name="buttonShare.style.bw"
                    label={t("customize.components.style.borderWidth")}
                />
            </StyleGroup>
            <StyleGroup label={t("customize.components.style.groupPadding")}>
                <SizeRow
                    form={form}
                    name="buttonShare.style.py"
                    label={t("customize.components.style.paddingVertical")}
                />
                <SizeRow
                    form={form}
                    name="buttonShare.style.px"
                    label={t("customize.components.style.paddingHorizontal")}
                />
            </StyleGroup>
            <StyleGroup label={t("customize.components.style.groupMargin")}>
                <SizeRow
                    form={form}
                    name="buttonShare.style.mt"
                    label={t("customize.components.style.marginTop")}
                />
                <SizeRow
                    form={form}
                    name="buttonShare.style.mb"
                    label={t("customize.components.style.marginBottom")}
                />
                <SizeRow
                    form={form}
                    name="buttonShare.style.ml"
                    label={t("customize.components.style.marginLeft")}
                />
                <SizeRow
                    form={form}
                    name="buttonShare.style.mr"
                    label={t("customize.components.style.marginRight")}
                />
            </StyleGroup>
            {tier === DEFAULT_TIER && (
                <Text variant="caption" color="tertiary">
                    {t("customize.components.style.defaultTierHint")}
                </Text>
            )}
        </Stack>
    );
}
