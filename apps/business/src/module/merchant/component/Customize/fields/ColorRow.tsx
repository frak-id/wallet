import { useRef } from "react";
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
