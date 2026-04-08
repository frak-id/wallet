import { Input } from "@frak-labs/ui/component/forms/Input";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { FormActions } from "@/module/forms/FormActions";
import styles from "./index.module.css";
import {
    EMBEDDED_TRANSLATION_GROUPS,
    MODAL_TRANSLATION_GROUPS,
    SHARING_PAGE_TRANSLATION_GROUPS,
    TRANSLATION_KEY_META,
    TRANSLATION_LANG_FIELDS,
} from "./translations";
import type { TranslationFormValues, TranslationLang } from "./types";
import { getNestedFieldError } from "./utils";

type TranslationGroups = Record<string, readonly string[]>;

function TranslationGroupList({
    groups,
    expandedGroups,
    onToggleGroup,
    form,
    fieldPrefix,
    activeField,
    defaultValues,
    lang,
}: {
    groups: TranslationGroups;
    expandedGroups: Record<string, boolean>;
    onToggleGroup: (groupName: string) => void;
    form: UseFormReturn<TranslationFormValues>;
    fieldPrefix: string;
    activeField: keyof TranslationFormValues;
    defaultValues?: TranslationFormValues;
    lang: TranslationLang;
}) {
    return (
        <>
            {Object.entries(groups).map(([groupName, keys]) => {
                const isExpanded = !!expandedGroups[groupName];

                return (
                    <div
                        key={groupName}
                        className={styles.customize__translationGroup}
                    >
                        <button
                            type="button"
                            className={styles.customize__translationGroupHeader}
                            onClick={() => onToggleGroup(groupName)}
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
                                    const meta =
                                        TRANSLATION_KEY_META[translationKey];

                                    return (
                                        <div
                                            key={translationKey}
                                            className={
                                                styles.customize__translationRow
                                            }
                                        >
                                            <label
                                                className={
                                                    styles.customize__translationLabel
                                                }
                                                htmlFor={`${fieldPrefix}.${fieldName}`}
                                            >
                                                {meta?.label ?? translationKey}
                                            </label>

                                            {meta?.description && (
                                                <p
                                                    className={
                                                        styles.customize__fieldDescription
                                                    }
                                                >
                                                    {meta.description}
                                                </p>
                                            )}

                                            <p
                                                className={
                                                    styles.customize__translationKeyMuted
                                                }
                                            >
                                                {translationKey}
                                            </p>

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
        </>
    );
}

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
    const [showAdvanced, setShowAdvanced] = useState(false);
    const activeField = TRANSLATION_LANG_FIELDS[lang];

    const handleToggleGroup = (groupName: string) => {
        setExpandedGroups((prevState) => ({
            ...prevState,
            [groupName]: !prevState[groupName],
        }));
    };

    const sharedProps = {
        expandedGroups,
        onToggleGroup: handleToggleGroup,
        form,
        fieldPrefix,
        activeField,
        defaultValues,
        lang,
    };

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

            <TranslationGroupList
                groups={SHARING_PAGE_TRANSLATION_GROUPS}
                {...sharedProps}
            />

            <div className={styles.customize__advancedSection}>
                <button
                    type="button"
                    className={styles.customize__advancedToggle}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                >
                    {showAdvanced ? (
                        <ChevronDown size={16} />
                    ) : (
                        <ChevronRight size={16} />
                    )}
                    Advanced
                </button>

                {showAdvanced && (
                    <div className={styles.customize__advancedBody}>
                        <p className={styles.customize__hint}>
                            Advanced — Embedded Wallet translations
                        </p>
                        <p className={styles.customize__fieldDescription}>
                            These translations apply to the embedded wallet
                            flow.
                        </p>
                        <TranslationGroupList
                            groups={EMBEDDED_TRANSLATION_GROUPS}
                            {...sharedProps}
                        />

                        <hr />

                        <p className={styles.customize__hint}>
                            Modal Flow translations
                        </p>
                        <p className={styles.customize__fieldDescription}>
                            These translations apply to the pop-up modal flow.
                        </p>
                        <TranslationGroupList
                            groups={MODAL_TRANSLATION_GROUPS}
                            {...sharedProps}
                        />
                    </div>
                )}
            </div>
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
