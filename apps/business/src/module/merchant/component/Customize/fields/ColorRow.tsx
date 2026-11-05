import { Inline } from "@frak-labs/design-system/components/Inline";
import { type Ref, useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { EditField } from "@/module/forms/EditField";
import { FormControl, FormField } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import * as styles from "../customize.css";
import { type ColorKey, isHexColor, TRANSPARENT } from "../style/styleCodec";
import type { ComponentSettingsFormValues } from "../types";

export type ColorName = `buttonShare.style.${ColorKey}`;

export const SWATCH_FALLBACK = "#000000";

type ColorControlProps = {
    name: string;
    label: string;
    value: string;
    onChange: (next: string) => void;
    onBlur: () => void;
    inputRef?: Ref<HTMLInputElement>;
    allowTransparent?: boolean;
    /** Defaults to any hex notation; a stricter caller narrows what can be typed. */
    isValid?: (value: string) => boolean;
    /** Shown while empty, when empty means a colour chosen elsewhere rather than black. */
    emptyLabel?: string;
};

export function ColorControl({
    name,
    label,
    value: raw,
    onChange,
    onBlur,
    inputRef,
    allowTransparent = false,
    isValid = isHexColor,
    emptyLabel,
}: ColorControlProps) {
    const { t } = useTranslation();
    const lastValid = useRef("");
    const isNone = raw === TRANSPARENT;
    const isAutomatic = Boolean(emptyLabel) && raw === "";
    const swatch = isValid(raw) ? raw : SWATCH_FALLBACK;

    // Tracks the rendered value, not just typed input: switching
    // placement re-syncs the form without remounting this row.
    useEffect(() => {
        if (isAutomatic || isValid(raw)) lastValid.current = raw;
    }, [raw, isValid, isAutomatic]);

    return (
        <EditField label={label}>
            <Inline space="xs" alignY="center" wrap={false}>
                <FormControl className={styles.colorField}>
                    <Input
                        variant="bare"
                        tone="muted"
                        placeholder={emptyLabel ?? SWATCH_FALLBACK}
                        name={name}
                        ref={inputRef}
                        disabled={isNone}
                        value={isNone ? "" : raw}
                        data-testid={`${name}-hex`}
                        onChange={(event) => onChange(event.target.value)}
                        onBlur={() => {
                            const keepsEmpty =
                                Boolean(emptyLabel) && raw === "";
                            if (!isNone && !keepsEmpty && !isValid(raw)) {
                                onChange(lastValid.current);
                            }
                            onBlur();
                        }}
                    />
                </FormControl>
                <Inline
                    space="xs"
                    alignY="center"
                    wrap={false}
                    className={styles.colorActions}
                >
                    <input
                        type="color"
                        className={styles.colorSwatch}
                        aria-label={t(
                            "customize.components.style.swatchLabel",
                            {
                                label,
                            }
                        )}
                        disabled={isNone}
                        value={swatch}
                        data-automatic={isAutomatic || undefined}
                        data-testid={`${name}-swatch`}
                        onChange={(event) => onChange(event.target.value)}
                    />
                    <button
                        type="button"
                        className={styles.styleGhostButton}
                        data-testid={`${name}-clear`}
                        onClick={() => onChange("")}
                    >
                        {t("customize.components.style.clear")}
                    </button>
                    {allowTransparent && (
                        <button
                            type="button"
                            aria-pressed={isNone}
                            className={styles.styleGhostButton}
                            data-testid={`${name}-none`}
                            onClick={() => onChange(isNone ? "" : TRANSPARENT)}
                        >
                            {t("customize.components.style.none")}
                        </button>
                    )}
                </Inline>
            </Inline>
        </EditField>
    );
}

export function ColorRow({
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
    return (
        <FormField
            control={form.control}
            name={name}
            render={({ field }) => (
                <ColorControl
                    name={field.name}
                    label={label}
                    value={typeof field.value === "string" ? field.value : ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    allowTransparent={allowTransparent}
                />
            )}
        />
    );
}
