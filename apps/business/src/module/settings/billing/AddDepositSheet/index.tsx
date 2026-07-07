import { Button } from "@frak-labs/design-system/components/Button";
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
import {
    Sheet,
    SheetContent,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button as BusinessButton } from "@/module/common/component/Button";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { SheetCloseToolbar } from "@/module/common/component/SheetCloseToolbar";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { COUNTRIES } from "@/module/common/utils/countries";
import { getNumberFormat } from "@/module/common/utils/intlCache";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import * as sheetStyles from "../BillingInfoSheet/billing-info-sheet.css";
import { computeDepositBreakdown } from "../computeDepositBreakdown";
import { DECIMAL_PATTERN, TX_HASH_PATTERN } from "../queryKeys";
import { type CreateDepositInput, useCreateDeposit } from "../useBillingAdmin";

const STABLECOINS = ["eure", "gbpe", "usde", "usdc"] as const;

type DepositFormValues = {
    grossAmount: string;
    currency: (typeof STABLECOINS)[number];
    documentDate: string;
    country: string;
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

    const initialValues = emptyValues(defaultCountry);
    const form = useForm<DepositFormValues>({
        defaultValues: initialValues,
        mode: "onChange",
    });

    const { guard, dialogProps } = useDiscardGuard({
        isDirty: form.formState.isDirty,
        onDiscard: () => form.reset(initialValues),
    });

    function requestClose() {
        guard(() => setOpen(false));
    }

    // Live, display-only VAT/fee/net preview mirroring the server math
    // (computeDepositBreakdown) — the backend recomputes authoritatively on
    // submit; this only guides the operator as they type gross + country.
    const [grossAmount, country, currency] = form.watch([
        "grossAmount",
        "country",
        "currency",
    ]);
    const breakdown = useMemo(
        () => computeDepositBreakdown(grossAmount, country),
        [grossAmount, country]
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
            paymentPlatform: values.paymentPlatform || undefined,
            note: values.note || undefined,
            txHash: (values.txHash || undefined) as `0x${string}` | undefined,
        };
        createDeposit.mutate(input, {
            onSuccess: () => {
                form.reset(emptyValues(defaultCountry));
                setOpen(false);
            },
        });
    }

    return (
        <Sheet
            open={open}
            onOpenChange={(next) => {
                if (next) {
                    setOpen(true);
                    return;
                }
                requestClose();
            }}
        >
            <SheetTrigger asChild>
                <BusinessButton variant="secondary" size="small">
                    {t("settings.billing.admin.deposit.trigger")}
                </BusinessButton>
            </SheetTrigger>
            <SheetContent
                side="right"
                size="wide"
                padded={false}
                hideCloseButton
                onEscapeKeyDown={(e) => {
                    e.preventDefault();
                    requestClose();
                }}
                onInteractOutside={(e) => {
                    e.preventDefault();
                    requestClose();
                }}
            >
                <SheetCloseToolbar
                    size="large"
                    onClose={requestClose}
                    closeLabel={t("settings.billing.actions.close")}
                    title={t("settings.billing.admin.deposit.title")}
                    subtitle={t("settings.billing.admin.deposit.description")}
                />
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
                                                                        key={
                                                                            coin
                                                                        }
                                                                        value={
                                                                            coin
                                                                        }
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
                                        <FormField
                                            control={form.control}
                                            name="documentDate"
                                            rules={{
                                                required: t(
                                                    "settings.billing.validation.required"
                                                ),
                                            }}
                                            render={({ field }) => (
                                                <EditField
                                                    label={t(
                                                        "settings.billing.admin.fields.documentDate.label"
                                                    )}
                                                >
                                                    <FormControl>
                                                        <Input
                                                            type="date"
                                                            variant="bare"
                                                            tone="muted"
                                                            length="big"
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
                                                            field.value ||
                                                            "none"
                                                        }
                                                        onValueChange={(
                                                            value
                                                        ) =>
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
                                        <FormField
                                            control={form.control}
                                            name="txHash"
                                            rules={{
                                                pattern: {
                                                    value: TX_HASH_PATTERN,
                                                    message: t(
                                                        "settings.billing.validation.txHash"
                                                    ),
                                                },
                                            }}
                                            render={({ field }) => (
                                                <EditField
                                                    label={t(
                                                        "settings.billing.admin.fields.txHash.label"
                                                    )}
                                                >
                                                    <FormControl>
                                                        <Input
                                                            variant="bare"
                                                            tone="muted"
                                                            length="big"
                                                            placeholder="0x…"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </EditField>
                                            )}
                                        />
                                    </Column>
                                </Columns>
                                <FormField
                                    control={form.control}
                                    name="note"
                                    render={({ field }) => (
                                        <EditField
                                            label={t(
                                                "settings.billing.admin.fields.note.label"
                                            )}
                                        >
                                            <FormControl>
                                                <Input
                                                    variant="bare"
                                                    tone="muted"
                                                    length="big"
                                                    placeholder={t(
                                                        "settings.billing.admin.fields.note.placeholder"
                                                    )}
                                                    {...field}
                                                />
                                            </FormControl>
                                        </EditField>
                                    )}
                                />
                                {createDeposit.isError && (
                                    <Text variant="caption" color="error">
                                        {t(
                                            "settings.billing.admin.errors.create"
                                        )}
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
                                        <Text
                                            variant="bodySmall"
                                            color="secondary"
                                        >
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
                                        <Text
                                            variant="bodySmall"
                                            color="secondary"
                                        >
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
                                        <Text
                                            variant="bodySmall"
                                            color="secondary"
                                        >
                                            {t(
                                                "settings.billing.admin.breakdown.frakFee"
                                            )}
                                        </Text>
                                        <Text variant="bodySmall">
                                            {formatAmount(breakdown.frakFee)}
                                        </Text>
                                    </Inline>
                                    <Inline
                                        space="s"
                                        align="space-between"
                                        alignY="center"
                                    >
                                        <Text
                                            variant="bodySmall"
                                            weight="semiBold"
                                        >
                                            {t(
                                                "settings.billing.admin.breakdown.net"
                                            )}
                                        </Text>
                                        <Text
                                            variant="bodySmall"
                                            weight="semiBold"
                                        >
                                            {formatAmount(breakdown.net)}
                                        </Text>
                                    </Inline>
                                    <Text variant="caption" color="tertiary">
                                        {t(
                                            "settings.billing.admin.breakdown.hint"
                                        )}
                                    </Text>
                                </Stack>
                            </Card>
                        )}
                    </form>
                </Form>
                <Inline space="s" padding="l" align="left">
                    <Button
                        variant="secondary"
                        size="large"
                        className={sheetStyles.footerButton}
                        onClick={requestClose}
                    >
                        {t("settings.billing.actions.cancel")}
                    </Button>
                    <Button
                        variant="primary"
                        size="large"
                        width="full"
                        className={sheetStyles.footerButton}
                        loading={createDeposit.isPending}
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={
                            !form.formState.isValid || createDeposit.isPending
                        }
                    >
                        {t("settings.billing.admin.deposit.submit")}
                    </Button>
                </Inline>
            </SheetContent>
            <DiscardChangesDialog {...dialogProps} />
        </Sheet>
    );
}
