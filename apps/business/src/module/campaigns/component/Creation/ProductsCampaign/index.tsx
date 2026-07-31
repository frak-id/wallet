import { Badge } from "@frak-labs/design-system/components/Badge";
import { FieldLabel } from "@frak-labs/design-system/components/FieldLabel";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { DeleteIcon, PlusIcon } from "@frak-labs/design-system/icons";
import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { type Control, Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useSaveCampaign } from "@/module/campaigns/hook/useSaveCampaign";
import { Button } from "@/module/common/component/Button";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { Input } from "@/module/forms/Input";
import {
    campaignStore,
    PRODUCT_SCOPE_FIELDS,
    type ProductScopeField,
} from "@/stores/campaignStore";
import type { RuleConditions } from "@/types/Campaign";
import { InfoBanner } from "../InfoBanner";
import { WizardFieldCard } from "../WizardFieldCard";
import { WizardStep } from "../WizardStep";
import * as rows from "../wizardRows.css";
import * as styles from "./products.css";
import {
    DEFAULT_PRODUCTS_FORM,
    draftToProductsForm,
    isAdvancedScope,
    isListOperator,
    isNumericField,
    isProductsFormValid,
    operatorsFor,
    type ProductScopeOperator,
    type ProductsFormValues,
    productsFormToDraft,
} from "./utils";

const FORM_ID = "campaign-products-form";

/** Mirrors the backend's `PRODUCT_SCOPE_MAX_NODES` (CampaignManagementService.ts:35). */
const MAX_VALUES = 50;

const MODES = [
    {
        value: "all",
        titleKey: "campaigns.create.products.mode.all.title",
        descKey: "campaigns.create.products.mode.all.description",
    },
    {
        value: "specific",
        titleKey: "campaigns.create.products.mode.specific.title",
        descKey: "campaigns.create.products.mode.specific.description",
    },
] as const;

export function ModeField({
    control,
}: {
    control: Control<ProductsFormValues>;
}) {
    const { t } = useTranslation();
    return (
        <Controller
            control={control}
            name="mode"
            render={({ field }) => (
                <RadioGroup
                    value={field.value}
                    onValueChange={field.onChange}
                    className={rows.optionList}
                >
                    {MODES.map((mode) => (
                        <label
                            key={mode.value}
                            htmlFor={`scope-mode-${mode.value}`}
                            className={rows.optionRow}
                        >
                            <RadioGroupItem
                                id={`scope-mode-${mode.value}`}
                                value={mode.value}
                                size="l"
                            />
                            <span className={rows.optionMain}>
                                <Text variant="body" weight="medium">
                                    {t(mode.titleKey)}
                                </Text>
                                <Text variant="bodySmall" color="secondary">
                                    {t(mode.descKey)}
                                </Text>
                            </span>
                        </label>
                    ))}
                </RadioGroup>
            )}
        />
    );
}

/**
 * Field + operator selects. Changing the field kind (text ↔ numeric) resets
 * the operator to that kind's first entry, so the pair is never incoherent —
 * the backend rejects e.g. `starts_with` on `quantity`.
 */
export function PredicateField({
    control,
    setOperator,
}: {
    control: Control<ProductsFormValues>;
    setOperator: (operator: ProductScopeOperator) => void;
}) {
    const { t } = useTranslation();
    const field = useWatch({ control, name: "field" });
    const operators = operatorsFor(field);

    return (
        <div className={styles.predicateRow}>
            <FieldLabel
                label={t("campaigns.create.products.fieldLabel")}
                htmlFor="product-scope-field"
                className={styles.select}
            >
                <Controller
                    control={control}
                    name="field"
                    render={({ field: formField }) => (
                        <Select
                            value={formField.value}
                            onValueChange={(next: ProductScopeField) => {
                                formField.onChange(next);
                                if (
                                    isNumericField(next) !==
                                    isNumericField(field)
                                ) {
                                    setOperator(operatorsFor(next)[0]);
                                }
                            }}
                        >
                            <SelectTrigger id="product-scope-field">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {PRODUCT_SCOPE_FIELDS.map((name) => (
                                    <SelectItem key={name} value={name}>
                                        {t(
                                            `campaigns.create.products.field.${name}`
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </FieldLabel>
            <FieldLabel
                label={t("campaigns.create.products.operatorLabel")}
                htmlFor="product-scope-operator"
                className={styles.select}
            >
                <Controller
                    control={control}
                    name="operator"
                    render={({ field: formField }) => (
                        <Select
                            value={formField.value}
                            onValueChange={formField.onChange}
                        >
                            <SelectTrigger id="product-scope-operator">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {operators.map((operator) => (
                                    <SelectItem key={operator} value={operator}>
                                        {t(
                                            `campaigns.create.products.operator.${operator}`
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                />
            </FieldLabel>
        </div>
    );
}

/** List operators get add/remove rows; the rest edit a single value. */
export function ValuesField({
    control,
    values,
    setValues,
}: {
    control: Control<ProductsFormValues>;
    values: string[];
    setValues: (next: string[]) => void;
}) {
    const { t } = useTranslation();
    const field = useWatch({ control, name: "field" });
    const operator = useWatch({ control, name: "operator" });
    const isList = isListOperator(operator);
    const inputType = isNumericField(field) ? "number" : "text";
    const placeholder = t(`campaigns.create.products.placeholder.${field}`);

    if (!isList) {
        return (
            <Stack space="s">
                <Controller
                    control={control}
                    name="values.0"
                    render={({ field: formField }) => (
                        <Input
                            type={inputType}
                            value={formField.value ?? ""}
                            onChange={formField.onChange}
                            onBlur={formField.onBlur}
                            placeholder={placeholder}
                            label={t("campaigns.create.products.values.label")}
                        />
                    )}
                />
                {operator === "between" && (
                    <Controller
                        control={control}
                        name="valueTo"
                        render={({ field: formField }) => (
                            <Input
                                type={inputType}
                                value={formField.value ?? ""}
                                onChange={formField.onChange}
                                onBlur={formField.onBlur}
                                placeholder={t(
                                    "campaigns.create.products.valueToPlaceholder"
                                )}
                                label={t(
                                    "campaigns.create.products.valueToLabel"
                                )}
                            />
                        )}
                    />
                )}
            </Stack>
        );
    }

    return (
        <FieldLabel label={t("campaigns.create.products.values.label")}>
            <Stack space="s">
                {values.map((_, index) => (
                    <div key={index} className={styles.valueRow}>
                        <Controller
                            control={control}
                            name={`values.${index}` as const}
                            render={({ field: formField }) => (
                                <Input
                                    type={inputType}
                                    value={formField.value ?? ""}
                                    onChange={formField.onChange}
                                    onBlur={formField.onBlur}
                                    placeholder={placeholder}
                                    classNameWrapper={styles.valueInput}
                                    aria-label={t(
                                        "campaigns.create.products.valueAt",
                                        { index: index + 1 }
                                    )}
                                />
                            )}
                        />
                        {values.length > 1 && (
                            <button
                                type="button"
                                className={rows.rowIconButton}
                                aria-label={t(
                                    "campaigns.create.products.removeValue"
                                )}
                                onClick={() =>
                                    setValues(
                                        values.filter((_, i) => i !== index)
                                    )
                                }
                            >
                                <DeleteIcon width={20} height={20} />
                            </button>
                        )}
                    </div>
                ))}
                {values.length < MAX_VALUES && (
                    <Button
                        type="button"
                        variant="primary"
                        size="small"
                        rightIcon={<PlusIcon width={16} height={16} />}
                        onClick={() => setValues([...values, ""])}
                    >
                        {t("campaigns.create.products.addValue")}
                    </Button>
                )}
            </Stack>
        </FieldLabel>
    );
}

/**
 * A scope the form can't represent. Rendered read-only so the step neither
 * lies about the campaign nor rewrites a rule it can't round-trip.
 */
export function AdvancedScopeNotice({
    productScope,
}: {
    productScope?: RuleConditions;
}) {
    const { t } = useTranslation();
    const conditions = Array.isArray(productScope)
        ? productScope
        : (productScope?.conditions ?? []);

    return (
        <Stack space="s">
            <InfoBanner>{t("campaigns.create.products.advanced")}</InfoBanner>
            <div className={styles.chipRow}>
                {conditions.map((condition, index) => (
                    <Badge key={index} variant="neutral" size="small">
                        {"field" in condition
                            ? `${condition.field} ${condition.operator}`
                            : condition.logic}
                    </Badge>
                ))}
            </div>
        </Stack>
    );
}

/**
 * Product-scope step: restricts a purchase campaign to matching cart line
 * items. Sits before the reward step because a negative scope (`not in`)
 * forces every reward onto a matched-items basis — the reward step reads the
 * scope to offer, or force, that choice.
 */
export function ProductsCampaign() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const draft = campaignStore((s) => s.draft);
    const saveCampaign = useSaveCampaign();

    const isAdvanced = isAdvancedScope(draft);
    // productScope is purchase-only (backend rejects it on any other trigger).
    const isPurchase = draft.rule.trigger === "purchase";

    const defaultValues = useMemo(() => draftToProductsForm(draft), [draft]);
    const form = useForm<ProductsFormValues>({
        values: defaultValues,
        mode: "onChange",
    });

    const watched = useWatch({ control: form.control });
    const values = {
        ...DEFAULT_PRODUCTS_FORM,
        ...watched,
    } as ProductsFormValues;
    const isValid = isAdvanced || !isPurchase || isProductsFormValid(values);

    // `useSaveCampaign` commits the draft to the store only once the request
    // succeeds, so a rejected save leaves the persisted draft as it was.
    async function persist(formValues: ProductsFormValues) {
        return saveCampaign.mutateAsync(
            productsFormToDraft(formValues, { ...draft, merchantId })
        );
    }

    async function onSubmit(formValues: ProductsFormValues) {
        const saved = await persist(formValues);
        navigate({
            to: "/m/$merchantId/campaigns/draft/$campaignId/reward",
            params: { merchantId, campaignId: saved.id },
        });
    }

    return (
        <WizardStep
            stepKey="products"
            formId={FORM_ID}
            isValid={isValid}
            isPending={saveCampaign.isPending}
            onSaveDraft={form.handleSubmit(persist)}
            onClose={() => form.reset(defaultValues)}
            hasUnsavedChanges={form.formState.isDirty}
        >
            <form id={FORM_ID} onSubmit={form.handleSubmit(onSubmit)}>
                <Stack space="l">
                    {/* The backend rejects a negated scope whose rewards
                        aren't matched-basis; without this the failure is
                        silent and Continue just stops. */}
                    {saveCampaign.isError && (
                        <InfoBanner tone="error">
                            {t("campaigns.create.products.saveError")}
                        </InfoBanner>
                    )}
                    {!isPurchase ? (
                        <WizardFieldCard
                            space="xs"
                            label={t("campaigns.create.products.scope.label")}
                        >
                            <InfoBanner>
                                {t("campaigns.create.products.purchaseOnly")}
                            </InfoBanner>
                        </WizardFieldCard>
                    ) : isAdvanced ? (
                        <WizardFieldCard
                            space="xs"
                            label={t("campaigns.create.products.scope.label")}
                        >
                            <AdvancedScopeNotice
                                productScope={draft.rule.productScope}
                            />
                        </WizardFieldCard>
                    ) : (
                        <>
                            <WizardFieldCard
                                space="xs"
                                label={t(
                                    "campaigns.create.products.scope.label"
                                )}
                                description={t(
                                    "campaigns.create.products.scope.description"
                                )}
                            >
                                <ModeField control={form.control} />
                            </WizardFieldCard>

                            {values.mode === "specific" && (
                                <WizardFieldCard
                                    space="xs"
                                    label={t(
                                        "campaigns.create.products.predicate.label"
                                    )}
                                    description={t(
                                        "campaigns.create.products.predicate.description"
                                    )}
                                >
                                    <Stack space="m">
                                        <PredicateField
                                            control={form.control}
                                            setOperator={(operator) =>
                                                form.setValue(
                                                    "operator",
                                                    operator,
                                                    { shouldDirty: true }
                                                )
                                            }
                                        />
                                        <ValuesField
                                            control={form.control}
                                            values={values.values}
                                            setValues={(next) =>
                                                form.setValue("values", next, {
                                                    shouldDirty: true,
                                                })
                                            }
                                        />
                                    </Stack>
                                </WizardFieldCard>
                            )}
                        </>
                    )}
                </Stack>
            </form>
        </WizardStep>
    );
}
