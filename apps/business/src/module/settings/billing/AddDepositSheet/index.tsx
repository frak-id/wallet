import type { Stablecoin } from "@frak-labs/app-essentials";
import { Card } from "@frak-labs/design-system/components/Card";
import { Column } from "@frak-labs/design-system/components/Column";
import { Columns } from "@frak-labs/design-system/components/Columns";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@frak-labs/design-system/components/Select";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { COUNTRIES } from "@/module/common/utils/countries";
import { currencyOptions } from "@/module/common/utils/currencyOptions";
import { getNumberFormat } from "@/module/common/utils/intlCache";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import { AdminBillingSheet } from "../AdminBillingSheet";
import {
    DocumentDateField,
    NoteField,
    TxHashField,
} from "../AdminBillingSheet/fields";
import * as sheetStyles from "../BillingInfoSheet/billing-info-sheet.css";
import { computeDepositBreakdown } from "../computeDepositBreakdown";
import { type CreateDepositInput, useCreateDeposit } from "../useBillingAdmin";
import { DECIMAL_PATTERN } from "../validation";

/** Single source of truth for the stablecoin set (from `currencyOptions`). */
const STABLECOINS: readonly Stablecoin[] = currencyOptions.flatMap((group) =>
    group.options.map((option) => option.value)
);

type DepositFormValues = {
    grossAmount: string;
    currency: Stablecoin;
    documentDate: string;
    country: string;
    giftedAmount: string;
    paymentPlatform: "" | "shopify" | "stripe";
    note: string;
    txHash: string;
};

function emptyValues(defaultCountry?: string): DepositFormValues {
    return {
        grossAmount: "",
        currency: "eure",
        documentDate: "",
        country: defaultCountry ?? "",
        giftedAmount: "",
        paymentPlatform: "",
        note: "",
        txHash: "",
    };
}

/**
 * Platform-admin-only sheet to record a deposit note. VAT and the Frak fee
 * are computed server-side from `grossAmount` + `country` — this form only
 * captures the raw inputs (billing-feature-plan.md §4).
 */
export function AddDepositSheet({
    merchantId,
    defaultCountry,
}: {
    merchantId: string;
    defaultCountry?: string;
}) {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(false);
    const createDeposit = useCreateDeposit(merchantId);

    // `useForm` captures `defaultValues` on first render only; later
    // resets go through `resetForm`, which reads `defaultCountry` fresh.
    const form = useForm<DepositFormValues>({
        defaultValues: emptyValues(defaultCountry),
        mode: "onChange",
    });

    // `defaultCountry` (the merchant's saved accounting country) arrives
    // async from `useBillingInfo`, well after this sheet's `useForm` first
    // captures `defaultValues` — so the initial capture is almost always
    // empty (billing-feature-fixes.md B18). Backfill it once it resolves,
    // but only while the form is still pristine and the country field is
    // still empty, so it never clobbers input the operator already typed.
    useEffect(() => {
        if (!defaultCountry) return;
        if (form.formState.isDirty) return;
        if (form.getValues("country")) return;
        form.setValue("country", defaultCountry);
    }, [defaultCountry, form]);

    function resetForm() {
        form.reset(emptyValues(defaultCountry));
    }

    // Live, display-only VAT/fee/net preview mirroring the server math
    // (computeDepositBreakdown) — the backend recomputes authoritatively on
    // submit; this only guides the operator as they type gross + country.
    const [grossAmount, country, currency, giftedAmount] = form.watch([
        "grossAmount",
        "country",
        "currency",
        "giftedAmount",
    ]);
    const breakdown = useMemo(
        () => computeDepositBreakdown(grossAmount, country, giftedAmount),
        [grossAmount, country, giftedAmount]
    );
    const formatAmount = useMemo(() => {
        const fmt = getNumberFormat(i18n.language, {
            maximumFractionDigits: 2,
        });
        // Stablecoin codes (eure/usdc…) aren't ISO-4217, so append the code
        // rather than using Intl currency style (same convention as
        // BillingTable).
        return (value: number) =>
            `${fmt.format(value)} ${currency.toUpperCase()}`;
    }, [i18n.language, currency]);

    function onSubmit(values: DepositFormValues) {
        const input: CreateDepositInput = {
            grossAmount: values.grossAmount,
            currency: values.currency,
            documentDate: new Date(values.documentDate).toISOString(),
            country: values.country,
            giftedAmount: values.giftedAmount || undefined,
            paymentPlatform: values.paymentPlatform || undefined,
            note: values.note || undefined,
            txHash: (values.txHash || undefined) as `0x${string}` | undefined,
        };
        createDeposit.mutate(input, {
            onSuccess: () => {
                resetForm();
                setOpen(false);
            },
        });
    }

    return (
        <AdminBillingSheet
            triggerLabel={t("settings.billing.admin.deposit.trigger")}
            title={t("settings.billing.admin.deposit.title")}
            subtitle={t("settings.billing.admin.deposit.description")}
            submitLabel={t("settings.billing.admin.deposit.submit")}
            cancelLabel={t("settings.billing.actions.cancel")}
            closeLabel={t("settings.billing.actions.close")}
            isDirty={form.formState.isDirty}
            onDiscard={resetForm}
            open={open}
            onOpenChange={setOpen}
            isSubmitting={createDeposit.isPending}
            isSubmitDisabled={
                !form.formState.isValid || createDeposit.isPending
            }
            onSubmit={form.handleSubmit(onSubmit)}
        >
            <Form {...form}>
                <form
                    className={sheetStyles.body}
                    onSubmit={form.handleSubmit(onSubmit)}
                >
                    <Card variant="elevated" radius="m">
                        <Stack space="m">
                            <Columns space="m">
                                <Column width="1/2">
                                    <FormField
                                        control={form.control}
                                        name="grossAmount"
                                        rules={{
                                            required: t(
                                                "settings.billing.validation.required"
                                            ),
                                            pattern: {
                                                value: DECIMAL_PATTERN,
                                                message: t(
                                                    "settings.billing.validation.decimal"
                                                ),
                                            },
                                        }}
                                        render={({ field }) => (
                                            <EditField
                                                label={t(
                                                    "settings.billing.admin.fields.grossAmount.label"
                                                )}
                                            >
                                                <FormControl>
                                                    <Input
                                                        variant="bare"
                                                        tone="muted"
                                                        length="big"
                                                        inputMode="decimal"
                                                        placeholder={t(
                                                            "settings.billing.admin.fields.grossAmount.placeholder"
                                                        )}
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </EditField>
                                        )}
                                    />
                                </Column>
                                <Column width="1/2">
                                    <FormField
                                        control={form.control}
                                        name="currency"
                                        render={({ field }) => (
                                            <EditField
                                                label={t(
                                                    "settings.billing.admin.fields.currency.label"
                                                )}
                                            >
                                                <Select
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                >
                                                    <FormControl>
                                                        <SelectTrigger
                                                            ref={field.ref}
                                                            variant="bare"
                                                            tone="muted"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {STABLECOINS.map(
                                                            (coin) => (
                                                                <SelectItem
                                                                    key={coin}
                                                                    value={coin}
                                                                >
                                                                    {coin.toUpperCase()}
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </EditField>
                                        )}
                                    />
                                </Column>
                            </Columns>
                            <Columns space="m">
                                <Column width="1/2">
                                    <DocumentDateField<DepositFormValues>
                                        control={form.control}
                                        name="documentDate"
                                    />
                                </Column>
                                <Column width="1/2">
                                    <FormField
                                        control={form.control}
                                        name="country"
                                        rules={{
                                            required: t(
                                                "settings.billing.validation.required"
                                            ),
                                        }}
                                        render={({ field }) => (
                                            <EditField
                                                label={t(
                                                    "settings.billing.fields.country.label"
                                                )}
                                            >
                                                <Select
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                >
                                                    <FormControl>
                                                        <SelectTrigger
                                                            ref={field.ref}
                                                            variant="bare"
                                                            tone="muted"
                                                        >
                                                            <SelectValue
                                                                placeholder={t(
                                                                    "settings.billing.fields.country.placeholder"
                                                                )}
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {COUNTRIES.map(
                                                            (country) => (
                                                                <SelectItem
                                                                    key={
                                                                        country.code
                                                                    }
                                                                    value={
                                                                        country.code
                                                                    }
                                                                >
                                                                    {
                                                                        country.name
                                                                    }
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </EditField>
                                        )}
                                    />
                                </Column>
                            </Columns>
                            <Columns space="m">
                                <Column width="1/2">
                                    <FormField
                                        control={form.control}
                                        name="paymentPlatform"
                                        render={({ field }) => (
                                            <EditField
                                                label={t(
                                                    "settings.billing.admin.fields.paymentPlatform.label"
                                                )}
                                            >
                                                <Select
                                                    value={
                                                        field.value || "none"
                                                    }
                                                    onValueChange={(value) =>
                                                        field.onChange(
                                                            value === "none"
                                                                ? ""
                                                                : value
                                                        )
                                                    }
                                                >
                                                    <FormControl>
                                                        <SelectTrigger
                                                            ref={field.ref}
                                                            variant="bare"
                                                            tone="muted"
                                                        >
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="none">
                                                            {t(
                                                                "settings.billing.admin.fields.paymentPlatform.none"
                                                            )}
                                                        </SelectItem>
                                                        <SelectItem value="shopify">
                                                            Shopify
                                                        </SelectItem>
                                                        <SelectItem value="stripe">
                                                            Stripe
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </EditField>
                                        )}
                                    />
                                </Column>
                                <Column width="1/2">
                                    <TxHashField<DepositFormValues>
                                        control={form.control}
                                        name="txHash"
                                    />
                                </Column>
                            </Columns>
                            <FormField
                                control={form.control}
                                name="giftedAmount"
                                rules={{
                                    pattern: {
                                        value: DECIMAL_PATTERN,
                                        message: t(
                                            "settings.billing.validation.decimal"
                                        ),
                                    },
                                }}
                                render={({ field }) => (
                                    <EditField
                                        label={t(
                                            "settings.billing.admin.fields.giftedAmount.label"
                                        )}
                                        hint={t(
                                            "settings.billing.admin.fields.giftedAmount.hint"
                                        )}
                                    >
                                        <FormControl>
                                            <Input
                                                variant="bare"
                                                tone="muted"
                                                length="big"
                                                inputMode="decimal"
                                                placeholder={t(
                                                    "settings.billing.admin.fields.giftedAmount.placeholder"
                                                )}
                                                {...field}
                                            />
                                        </FormControl>
                                    </EditField>
                                )}
                            />
                            <NoteField<DepositFormValues>
                                control={form.control}
                                name="note"
                            />
                            {createDeposit.isError && (
                                <Text variant="caption" color="error">
                                    {t("settings.billing.admin.errors.create")}
                                </Text>
                            )}
                        </Stack>
                    </Card>
                    {breakdown && (
                        <Card variant="muted" radius="m">
                            <Stack space="s">
                                <Text variant="label" color="secondary">
                                    {t(
                                        "settings.billing.admin.breakdown.title"
                                    )}
                                </Text>
                                <Inline
                                    space="s"
                                    align="space-between"
                                    alignY="center"
                                >
                                    <Text variant="bodySmall" color="secondary">
                                        {t(
                                            "settings.billing.admin.breakdown.gross"
                                        )}
                                    </Text>
                                    <Text variant="bodySmall">
                                        {formatAmount(breakdown.gross)}
                                    </Text>
                                </Inline>
                                <Inline
                                    space="s"
                                    align="space-between"
                                    alignY="center"
                                >
                                    <Text variant="bodySmall" color="secondary">
                                        {t(
                                            breakdown.vatApplies
                                                ? "settings.billing.admin.breakdown.vat"
                                                : "settings.billing.admin.breakdown.vatExempt"
                                        )}
                                    </Text>
                                    <Text variant="bodySmall">
                                        {formatAmount(breakdown.vat)}
                                    </Text>
                                </Inline>
                                <Inline
                                    space="s"
                                    align="space-between"
                                    alignY="center"
                                >
                                    <Text variant="bodySmall" color="secondary">
                                        {t(
                                            "settings.billing.admin.breakdown.frakFee"
                                        )}
                                    </Text>
                                    <Text variant="bodySmall">
                                        {formatAmount(breakdown.frakFee)}
                                    </Text>
                                </Inline>
                                {breakdown.gifted > 0 && (
                                    <Inline
                                        space="s"
                                        align="space-between"
                                        alignY="center"
                                    >
                                        <Text
                                            variant="bodySmall"
                                            color="secondary"
                                        >
                                            {t(
                                                "settings.billing.admin.breakdown.gifted"
                                            )}
                                        </Text>
                                        <Text variant="bodySmall">
                                            {formatAmount(breakdown.gifted)}
                                        </Text>
                                    </Inline>
                                )}
                                <Inline
                                    space="s"
                                    align="space-between"
                                    alignY="center"
                                >
                                    <Text variant="bodySmall" weight="semiBold">
                                        {t(
                                            "settings.billing.admin.breakdown.net"
                                        )}
                                    </Text>
                                    <Text variant="bodySmall" weight="semiBold">
                                        {formatAmount(breakdown.net)}
                                    </Text>
                                </Inline>
                                <Text variant="caption" color="tertiary">
                                    {t("settings.billing.admin.breakdown.hint")}
                                </Text>
                            </Stack>
                        </Card>
                    )}
                </form>
            </Form>
        </AdminBillingSheet>
    );
}
