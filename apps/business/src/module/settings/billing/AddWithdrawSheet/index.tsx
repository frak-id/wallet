import { Card } from "@frak-labs/design-system/components/Card";
import { Column } from "@frak-labs/design-system/components/Column";
import { Columns } from "@frak-labs/design-system/components/Columns";
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
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { authenticatedBackendApi } from "@/api/backendClient";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import { AdminBillingSheet } from "../AdminBillingSheet";
import {
    DocumentDateField,
    NoteField,
    TxHashField,
} from "../AdminBillingSheet/fields";
import * as sheetStyles from "../BillingInfoSheet/billing-info-sheet.css";
import { documentsByKindQueryKey } from "../queryKeys";
import {
    type CreateWithdrawInput,
    maskIban,
    useCreateWithdraw,
} from "../useBillingAdmin";
import { DECIMAL_PATTERN } from "../validation";

type WithdrawFormValues = {
    remainingBankAmount: string;
    documentDate: string;
    linkedDepositId: string;
    rawIban: string;
    note: string;
    txHash: string;
};

const EMPTY_VALUES: WithdrawFormValues = {
    remainingBankAmount: "",
    documentDate: "",
    linkedDepositId: "",
    rawIban: "",
    note: "",
    txHash: "",
};

/**
 * The non-voided deposits available to link a withdraw restitution against.
 * Fetched fresh each time the sheet opens (not the shared documents query,
 * which excludes voided rows but includes withdraws too) so the picker only
 * ever lists `kind === "deposit"` documents.
 */
function useLinkableDeposits(merchantId: string, enabled: boolean) {
    return useQuery({
        queryKey: documentsByKindQueryKey(merchantId, "deposit"),
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .billing.documents.get({ query: { kind: "deposit" } });
            if (error) throw error;
            return data.documents;
        },
        enabled,
    });
}

/**
 * Platform-admin-only sheet to record a withdraw bill. Requires linking an
 * existing deposit (restitution source, billing-feature-plan.md §4) — its
 * currency is authoritative and the withdraw currency auto-follows it
 * (the backend rejects a currency mismatch).
 */
export function AddWithdrawSheet({ merchantId }: { merchantId: string }) {
    const { t } = useTranslation();
    const createWithdraw = useCreateWithdraw(merchantId);
    const [open, setOpen] = useState(false);
    const { data: deposits = [] } = useLinkableDeposits(merchantId, open);

    const form = useForm<WithdrawFormValues>({
        defaultValues: EMPTY_VALUES,
        mode: "onChange",
    });

    function resetForm() {
        form.reset(EMPTY_VALUES);
    }

    const linkedDepositId = form.watch("linkedDepositId");
    const linkedDeposit = useMemo(
        () => deposits.find((d) => d.id === linkedDepositId),
        [deposits, linkedDepositId]
    );

    function onSubmit(values: WithdrawFormValues) {
        if (!linkedDeposit) return;
        const input: CreateWithdrawInput = {
            remainingBankAmount: values.remainingBankAmount,
            currency: linkedDeposit.currency,
            documentDate: new Date(values.documentDate).toISOString(),
            linkedDepositId: values.linkedDepositId,
            rawIban: maskIban(values.rawIban),
            note: values.note || undefined,
            txHash: (values.txHash || undefined) as `0x${string}` | undefined,
        };
        createWithdraw.mutate(input, {
            onSuccess: () => {
                resetForm();
                setOpen(false);
            },
        });
    }

    return (
        <AdminBillingSheet
            triggerLabel={t("settings.billing.admin.withdraw.trigger")}
            title={t("settings.billing.admin.withdraw.title")}
            subtitle={t("settings.billing.admin.withdraw.description")}
            submitLabel={t("settings.billing.admin.withdraw.submit")}
            cancelLabel={t("settings.billing.actions.cancel")}
            closeLabel={t("settings.billing.actions.close")}
            isDirty={form.formState.isDirty}
            onDiscard={resetForm}
            open={open}
            onOpenChange={setOpen}
            isSubmitting={createWithdraw.isPending}
            isSubmitDisabled={
                !form.formState.isValid ||
                !linkedDeposit ||
                createWithdraw.isPending
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
                            <FormField
                                control={form.control}
                                name="linkedDepositId"
                                rules={{
                                    required: t(
                                        "settings.billing.validation.required"
                                    ),
                                }}
                                render={({ field }) => (
                                    <EditField
                                        label={t(
                                            "settings.billing.admin.fields.linkedDeposit.label"
                                        )}
                                    >
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                        >
                                            <FormControl>
                                                <SelectTrigger
                                                    ref={field.ref}
                                                    variant="bare"
                                                    tone="muted"
                                                >
                                                    <SelectValue
                                                        placeholder={t(
                                                            "settings.billing.admin.fields.linkedDeposit.placeholder"
                                                        )}
                                                    />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {deposits.map((d) => (
                                                    <SelectItem
                                                        key={d.id}
                                                        value={d.id}
                                                    >
                                                        {d.reference}
                                                        {d.grossAmount
                                                            ? ` \u2014 ${d.grossAmount} ${d.currency.toUpperCase()}`
                                                            : ""}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </EditField>
                                )}
                            />
                            <Columns space="m">
                                <Column width="1/2">
                                    <FormField
                                        control={form.control}
                                        name="remainingBankAmount"
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
                                                    "settings.billing.admin.fields.remainingBankAmount.label"
                                                )}
                                            >
                                                <FormControl>
                                                    <Input
                                                        variant="bare"
                                                        tone="muted"
                                                        length="big"
                                                        inputMode="decimal"
                                                        placeholder={t(
                                                            "settings.billing.admin.fields.remainingBankAmount.placeholder"
                                                        )}
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </EditField>
                                        )}
                                    />
                                </Column>
                                <Column width="1/2">
                                    <EditField
                                        label={t(
                                            "settings.billing.admin.fields.currency.label"
                                        )}
                                    >
                                        <Input
                                            variant="bare"
                                            tone="muted"
                                            length="big"
                                            readOnly
                                            disabled
                                            value={
                                                linkedDeposit
                                                    ? linkedDeposit.currency.toUpperCase()
                                                    : ""
                                            }
                                            placeholder={t(
                                                "settings.billing.admin.fields.currency.autoPlaceholder"
                                            )}
                                        />
                                    </EditField>
                                </Column>
                            </Columns>
                            <Columns space="m">
                                <Column width="1/2">
                                    <DocumentDateField<WithdrawFormValues>
                                        control={form.control}
                                        name="documentDate"
                                    />
                                </Column>
                                <Column width="1/2">
                                    <FormField
                                        control={form.control}
                                        name="rawIban"
                                        rules={{
                                            required: t(
                                                "settings.billing.validation.required"
                                            ),
                                        }}
                                        render={({ field }) => (
                                            <EditField
                                                label={t(
                                                    "settings.billing.admin.fields.rawIban.label"
                                                )}
                                                hint={t(
                                                    "settings.billing.admin.fields.rawIban.hint"
                                                )}
                                            >
                                                <FormControl>
                                                    <Input
                                                        variant="bare"
                                                        tone="muted"
                                                        length="big"
                                                        placeholder={t(
                                                            "settings.billing.admin.fields.rawIban.placeholder"
                                                        )}
                                                        {...field}
                                                    />
                                                </FormControl>
                                            </EditField>
                                        )}
                                    />
                                </Column>
                            </Columns>
                            <TxHashField<WithdrawFormValues>
                                control={form.control}
                                name="txHash"
                            />
                            <NoteField<WithdrawFormValues>
                                control={form.control}
                                name="note"
                            />
                            {createWithdraw.isError && (
                                <Text variant="caption" color="error">
                                    {t("settings.billing.admin.errors.create")}
                                </Text>
                            )}
                        </Stack>
                    </Card>
                </form>
            </Form>
        </AdminBillingSheet>
    );
}
