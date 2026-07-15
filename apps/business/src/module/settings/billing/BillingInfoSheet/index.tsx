import { isValidEmail } from "@frak-labs/app-essentials";
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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button as BusinessButton } from "@/module/common/component/Button";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { SheetCloseToolbar } from "@/module/common/component/SheetCloseToolbar";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { COUNTRIES } from "@/module/common/utils/countries";
import { EditField } from "@/module/forms/EditField";
import { Form, FormControl, FormField } from "@/module/forms/Form";
import type { BillingInfo } from "../types";
import * as styles from "./billing-info-sheet.css";

const EMPTY_INFO: BillingInfo = {
    companyName: "",
    vatNumber: "",
    streetAddress: "",
    city: "",
    postalCode: "",
    country: "",
    billingEmail: "",
};

type BillingInfoSheetProps = {
    mode: "add" | "edit";
    info?: BillingInfo | null;
    /**
     * Persist the edited info. Must invoke `opts.onSuccess` only when the
     * save actually succeeded — the sheet stays open (edits intact, inline
     * error shown) until then, so a failed PUT never silently discards the
     * merchant's changes (billing-feature-fixes.md B12).
     */
    onSave: (info: BillingInfo, opts?: { onSuccess?: () => void }) => void;
    /** Save mutation in flight — drives the submit button's loading state. */
    isSaving?: boolean;
    /** Last save attempt failed — shows the inline error message. */
    saveFailed?: boolean;
    /** Clears a stale error state (called when the sheet closes). */
    onResetSaveState?: () => void;
};

/**
 * Right-side drawer to add or edit the invoice informations. Mirrors the
 * merchant edit-sheet pattern (Sheet + close toolbar + react-hook-form + footer
 * actions + discard guard). In edit mode it shows Cancel + Save changes.
 * Closes only after a successful save; a failed save keeps the sheet open
 * with the edits and an inline error (B12).
 */
export function BillingInfoSheet({
    mode,
    info,
    onSave,
    isSaving = false,
    saveFailed = false,
    onResetSaveState,
}: BillingInfoSheetProps) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);

    const values = info ?? EMPTY_INFO;

    const form = useForm<BillingInfo>({
        values,
        defaultValues: EMPTY_INFO,
        // Validate as the user types so `isValid` reactively gates the Save button.
        mode: "onChange",
    });

    const { guard, dialogProps } = useDiscardGuard({
        isDirty: form.formState.isDirty,
        onDiscard: () => form.reset(values),
    });

    function closeSheet() {
        setOpen(false);
        onResetSaveState?.();
    }

    function onSubmit(next: BillingInfo) {
        // Close only once the save succeeded — on failure the sheet stays
        // open with the merchant's edits and the inline error below (B12).
        onSave(next, {
            onSuccess: () => {
                form.reset(next);
                closeSheet();
            },
        });
    }

    function requestClose() {
        guard(closeSheet);
    }

    const isEdit = mode === "edit";

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
                    {isEdit
                        ? t("settings.billing.actions.edit")
                        : t("settings.billing.actions.add")}
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
                    title={
                        isEdit
                            ? t("settings.billing.sheet.editTitle")
                            : t("settings.billing.sheet.addTitle")
                    }
                    subtitle={t("settings.billing.sheet.description")}
                />
                <Form {...form}>
                    <form
                        className={styles.body}
                        onSubmit={form.handleSubmit(onSubmit)}
                    >
                        <Card variant="elevated" radius="m">
                            <Stack space="m">
                                <Columns space="m">
                                    <Column width="1/2">
                                        <FormField
                                            control={form.control}
                                            name="companyName"
                                            rules={{
                                                required: t(
                                                    "settings.billing.validation.required"
                                                ),
                                            }}
                                            render={({ field }) => (
                                                <EditField>
                                                    <FormControl>
                                                        <Input
                                                            variant="bare"
                                                            tone="muted"
                                                            length="big"
                                                            placeholder={t(
                                                                "settings.billing.fields.companyName.placeholder"
                                                            )}
                                                            label={t(
                                                                "settings.billing.fields.companyName.label"
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
                                            name="vatNumber"
                                            rules={{
                                                required: t(
                                                    "settings.billing.validation.required"
                                                ),
                                            }}
                                            render={({ field }) => (
                                                <EditField>
                                                    <FormControl>
                                                        <Input
                                                            variant="bare"
                                                            tone="muted"
                                                            length="big"
                                                            placeholder={t(
                                                                "settings.billing.fields.vatNumber.placeholder"
                                                            )}
                                                            label={t(
                                                                "settings.billing.fields.vatNumber.label"
                                                            )}
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
                                    name="streetAddress"
                                    rules={{
                                        required: t(
                                            "settings.billing.validation.required"
                                        ),
                                    }}
                                    render={({ field }) => (
                                        <EditField>
                                            <FormControl>
                                                <Input
                                                    variant="bare"
                                                    tone="muted"
                                                    length="big"
                                                    placeholder={t(
                                                        "settings.billing.fields.streetAddress.placeholder"
                                                    )}
                                                    label={t(
                                                        "settings.billing.fields.streetAddress.label"
                                                    )}
                                                    {...field}
                                                />
                                            </FormControl>
                                        </EditField>
                                    )}
                                />
                                <Columns space="m">
                                    <Column width="1/2">
                                        <FormField
                                            control={form.control}
                                            name="city"
                                            rules={{
                                                required: t(
                                                    "settings.billing.validation.required"
                                                ),
                                            }}
                                            render={({ field }) => (
                                                <EditField>
                                                    <FormControl>
                                                        <Input
                                                            variant="bare"
                                                            tone="muted"
                                                            length="big"
                                                            placeholder={t(
                                                                "settings.billing.fields.city.placeholder"
                                                            )}
                                                            label={t(
                                                                "settings.billing.fields.city.label"
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
                                            name="postalCode"
                                            rules={{
                                                required: t(
                                                    "settings.billing.validation.required"
                                                ),
                                            }}
                                            render={({ field }) => (
                                                <EditField>
                                                    <FormControl>
                                                        <Input
                                                            variant="bare"
                                                            tone="muted"
                                                            length="big"
                                                            placeholder={t(
                                                                "settings.billing.fields.postalCode.placeholder"
                                                            )}
                                                            label={t(
                                                                "settings.billing.fields.postalCode.label"
                                                            )}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </EditField>
                                            )}
                                        />
                                    </Column>
                                </Columns>
                                <Columns space="m">
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
                                                                onBlur={
                                                                    field.onBlur
                                                                }
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
                                    <Column width="1/2">
                                        <FormField
                                            control={form.control}
                                            name="billingEmail"
                                            rules={{
                                                required: t(
                                                    "settings.billing.validation.required"
                                                ),
                                                validate: (value) =>
                                                    isValidEmail(value) ||
                                                    t(
                                                        "settings.billing.validation.email"
                                                    ),
                                            }}
                                            render={({ field }) => (
                                                <EditField>
                                                    <FormControl>
                                                        <Input
                                                            type="email"
                                                            variant="bare"
                                                            tone="muted"
                                                            length="big"
                                                            placeholder={t(
                                                                "settings.billing.fields.billingEmail.placeholder"
                                                            )}
                                                            label={t(
                                                                "settings.billing.fields.billingEmail.label"
                                                            )}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </EditField>
                                            )}
                                        />
                                    </Column>
                                </Columns>
                            </Stack>
                        </Card>
                        {saveFailed && (
                            <Text variant="caption" color="error">
                                {t("settings.billing.errors.save")}
                            </Text>
                        )}
                    </form>
                </Form>
                <Inline
                    space="s"
                    padding="l"
                    align={isEdit ? "left" : "center"}
                >
                    {isEdit && (
                        <Button
                            variant="secondary"
                            size="large"
                            className={styles.footerButton}
                            onClick={requestClose}
                        >
                            {t("settings.billing.actions.cancel")}
                        </Button>
                    )}
                    <Button
                        variant="primary"
                        size="large"
                        width={isEdit ? "full" : "auto"}
                        className={isEdit ? styles.footerButton : undefined}
                        loading={isSaving}
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={
                            isSaving ||
                            (isEdit
                                ? // Edit: enable as soon as a change is detected
                                  // (Figma note); invalid input is blocked on submit.
                                  !form.formState.isDirty
                                : // Add: require a complete, valid form.
                                  !form.formState.isDirty ||
                                  !form.formState.isValid)
                        }
                    >
                        {isEdit
                            ? t("settings.billing.actions.saveChanges")
                            : t("settings.billing.actions.save")}
                    </Button>
                </Inline>
            </SheetContent>
            <DiscardChangesDialog {...dialogProps} />
        </Sheet>
    );
}
