import { Input } from "@frak-labs/ui/component/forms/Input";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormActions } from "@/module/forms/FormActions";
import styles from "./index.module.css";
import {
    getNestedFieldError,
    TRANSLATION_GROUPS,
    TRANSLATION_LANG_FIELDS,
    type TranslationFormValues,
    type TranslationLang,
} from "./utils";

export function TranslationEditor({
    form,
    fieldPrefix,
    defaultValues,
    lang,
    onLangChange,
}: {
    form: UseFormReturn<TranslationFormValues>;
    fieldPrefix: string;
    defaultValues?: TranslationFormValues;
    lang: TranslationLang;
    onLangChange: (lang: TranslationLang) => void;
}) {
    const [expandedGroups, setExpandedGroups] = useState<
        Record<string, boolean>
    >({});
    const activeField = TRANSLATION_LANG_FIELDS[lang];

    return (
        <div>
            <div className={styles.customize__translationLangTabs}>
                <button
                    type="button"
                    className={`${styles.customize__translationLangTab} ${
                        lang === "default"
                            ? styles["customize__translationLangTab--active"]
                            : ""
                    }`}
                    onClick={() => onLangChange("default")}
                >
                    Default (all languages)
                </button>
                <button
                    type="button"
                    className={`${styles.customize__translationLangTab} ${
                        lang === "en"
                            ? styles["customize__translationLangTab--active"]
                            : ""
                    }`}
                    onClick={() => onLangChange("en")}
                >
                    English (EN)
                </button>
                <button
                    type="button"
                    className={`${styles.customize__translationLangTab} ${
                        lang === "fr"
                            ? styles["customize__translationLangTab--active"]
                            : ""
                    }`}
                    onClick={() => onLangChange("fr")}
                >
                    French (FR)
                </button>
            </div>

            {Object.entries(TRANSLATION_GROUPS).map(([groupName, keys]) => {
                const isExpanded = !!expandedGroups[groupName];

                return (
                    <div
                        key={groupName}
                        className={styles.customize__translationGroup}
                    >
                        <button
                            type="button"
                            className={styles.customize__translationGroupHeader}
                            onClick={() =>
                                setExpandedGroups((prevState) => ({
                                    ...prevState,
                                    [groupName]: !prevState[groupName],
                                }))
                            }
                        >
                            {isExpanded ? (
                                <ChevronDown size={16} />
                            ) : (
                                <ChevronRight size={16} />
                            )}
                            {groupName}
                        </button>

                        {isExpanded && (
                            <div
                                className={
                                    styles.customize__translationGroupBody
                                }
                            >
                                {keys.map((translationKey) => {
                                    const fieldName =
                                        `${activeField}.${translationKey}` as const;
                                    const inheritedValue =
                                        defaultValues?.[activeField]?.[
                                            translationKey
                                        ];
                                    const fieldError = getNestedFieldError(
                                        form.formState.errors[
                                            activeField
                                        ] as unknown as
                                            | Record<string, unknown>
                                            | undefined,
                                        translationKey
                                    );

                                    return (
                                        <div
                                            key={translationKey}
                                            className={
                                                styles.customize__translationRow
                                            }
                                        >
                                            <label
                                                className={
                                                    styles.customize__translationKey
                                                }
                                                htmlFor={`${fieldPrefix}.${fieldName}`}
                                            >
                                                {translationKey}
                                            </label>

                                            {inheritedValue && (
                                                <p
                                                    className={
                                                        styles.customize__hint
                                                    }
                                                >
                                                    Inherited default:{" "}
                                                    {inheritedValue}
                                                </p>
                                            )}

                                            <Input
                                                id={`${fieldPrefix}.${fieldName}`}
                                                length={"big"}
                                                placeholder={`Enter ${lang.toUpperCase()} override`}
                                                {...form.register(fieldName, {
                                                    validate: (
                                                        value: string
                                                    ) => {
                                                        const trimmed =
                                                            value?.trim() ?? "";
                                                        if (
                                                            trimmed.length === 0
                                                        ) {
                                                            return true;
                                                        }

                                                        if (
                                                            trimmed.length < 5
                                                        ) {
                                                            return "Minimum length is 5 characters";
                                                        }

                                                        if (
                                                            trimmed.length > 200
                                                        ) {
                                                            return "Maximum length is 200 characters";
                                                        }

                                                        return true;
                                                    },
                                                })}
                                            />

                                            {fieldError && (
                                                <p className={"error"}>
                                                    {fieldError}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

export function CssEditor({
    value,
    onChange,
    placeholder,
    isPending,
    isSuccess,
    isDirty,
    onSave,
    onDiscard,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    isPending: boolean;
    isSuccess: boolean;
    isDirty: boolean;
    onSave: () => void;
    onDiscard: () => void;
}) {
    return (
        <>
            <textarea
                className={styles.customize__textarea}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
            />
            <FormActions
                isSuccess={isSuccess}
                isPending={isPending}
                isDirty={isDirty}
                onDiscard={onDiscard}
                onSubmit={onSave}
            />
        </>
    );
}
