import {
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import { Button } from "@frak-labs/design-system/components/Button";
import { GlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import {
    RadioGroup,
    RadioGroupItem,
} from "@frak-labs/design-system/components/RadioGroup";
import {
    Sheet,
    SheetContent,
    SheetToolbar,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    EurIcon,
    GbpIcon,
    UsdcIcon,
    UsdIcon,
} from "@frak-labs/design-system/icons";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button as BusinessButton } from "@/module/common/component/Button";
import { DiscardChangesDialog } from "@/module/common/component/DiscardChangesDialog";
import { useDiscardGuard } from "@/module/common/hook/useDiscardGuard";
import { currencyMetadata } from "@/module/common/utils/currencyOptions";
import { detectStablecoinFromAddress } from "@/module/common/utils/stablecoin";
import { EditField } from "@/module/forms/EditField";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage,
} from "@/module/forms/Form";
import { useMerchantUpdate } from "@/module/merchant/hook/useMerchantUpdate";
import type { MerchantData } from "@/module/merchant/queries/queryOptions";
import * as styles from "./merchant-edit-sheet.css";

type FormMerchant = {
    name: string;
    domain: string;
    defaultCurrency: Stablecoin;
};

const CURRENCY_ICONS: Record<Stablecoin, ReactNode> = {
    eure: <EurIcon className={styles.currencyIcon} />,
    gbpe: <GbpIcon className={styles.currencyIcon} />,
    usde: <UsdIcon className={styles.currencyIcon} />,
    usdc: <UsdcIcon className={styles.currencyIcon} />,
};

const CURRENCIES = Object.keys(currencyMetadata) as Stablecoin[];

function CurrencyRadioGroup({
    value,
    onChange,
}: {
    value: Stablecoin;
    onChange: (value: Stablecoin) => void;
}) {
    const groupId = useId();
    return (
        <RadioGroup
            className={styles.currencyGrid}
            value={value}
            onValueChange={(next) => next && onChange(next as Stablecoin)}
        >
            {CURRENCIES.map((currency) => {
                const meta = currencyMetadata[currency];
                const itemId = `${groupId}-${currency}`;
                return (
                    <label
                        key={currency}
                        htmlFor={itemId}
                        className={styles.currencyCell}
                    >
                        <RadioGroupItem id={itemId} value={currency} size="l" />
                        <Inline
                            as="span"
                            space="xs"
                            alignY="center"
                            wrap={false}
                            className={styles.currencyMain}
                        >
                            <span className={styles.currencyIcon}>
                                {CURRENCY_ICONS[currency]}
                            </span>
                            <Stack
                                as="span"
                                space="xxs"
                                className={styles.currencyText}
                            >
                                <Text as="span" variant="body" weight="medium">
                                    {meta.label}
                                </Text>
                                <Text
                                    as="span"
                                    variant="bodySmall"
                                    color="secondary"
                                >
                                    {meta.provider}
                                </Text>
                            </Stack>
                        </Inline>
                    </label>
                );
            })}
        </RadioGroup>
    );
}

export function MerchantEditSheet({
    merchant,
    merchantId,
}: {
    merchant: MerchantData;
    merchantId: string;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const { mutate: editMerchant, isPending: editMerchantPending } =
        useMerchantUpdate({ merchantId, target: "base" });

    const formValues = useMemo<FormMerchant>(
        () => ({
            name: merchant.name,
            domain: merchant.domain,
            defaultCurrency:
                detectStablecoinFromAddress(merchant.defaultRewardToken) ??
                "eure",
        }),
        [merchant]
    );

    const form = useForm<FormMerchant>({
        values: formValues,
        defaultValues: formValues,
    });

    const { guard, dialogProps } = useDiscardGuard({
        isDirty: form.formState.isDirty,
        onDiscard: () => form.reset(formValues),
    });

    function onSubmit(values: FormMerchant) {
        editMerchant(
            {
                name: values.name,
                defaultRewardToken: getTokenAddressForStablecoin(
                    values.defaultCurrency
                ),
            },
            {
                onSuccess: () => {
                    form.reset(form.getValues());
                    setOpen(false);
                },
            }
        );
    }

    function requestClose() {
        guard(() => setOpen(false));
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
                    {t("merchantEdit.details.edit")}
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
                <SheetToolbar
                    size="large"
                    leading={
                        <GlassCloseButton
                            onClick={requestClose}
                            aria-label={t("merchantEdit.close")}
                        />
                    }
                    title={t("merchantEdit.editMerchant.title")}
                    subtitle={t("merchantEdit.editMerchant.description")}
                />
                <Form {...form}>
                    <form
                        className={styles.body}
                        onSubmit={form.handleSubmit(onSubmit)}
                    >
                        <FormField
                            control={form.control}
                            name="name"
                            rules={{
                                required: t(
                                    "merchantEdit.editMerchant.nameRequired"
                                ),
                            }}
                            render={({ field }) => (
                                <EditField
                                    tone="card"
                                    label={t("merchantEdit.editMerchant.name")}
                                >
                                    <FormControl>
                                        <Input
                                            variant="bare"
                                            tone="muted"
                                            length="big"
                                            placeholder={t(
                                                "merchantEdit.editMerchant.namePlaceholder"
                                            )}
                                            {...field}
                                        />
                                    </FormControl>
                                </EditField>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="domain"
                            render={({ field }) => (
                                <EditField
                                    tone="card"
                                    label={t(
                                        "merchantEdit.editMerchant.domain"
                                    )}
                                >
                                    <FormControl>
                                        <Input
                                            variant="bare"
                                            tone="muted"
                                            length="big"
                                            disabled
                                            {...field}
                                        />
                                    </FormControl>
                                </EditField>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="defaultCurrency"
                            render={({ field }) => (
                                <FormItem>
                                    <Stack
                                        space="xs"
                                        padding="m"
                                        className={styles.fieldCard}
                                    >
                                        <Text
                                            variant="bodySmall"
                                            weight="medium"
                                            color="secondary"
                                        >
                                            {t(
                                                "merchantEdit.editMerchant.currency"
                                            )}
                                        </Text>
                                        <CurrencyRadioGroup
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    </Stack>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Stack
                            space="m"
                            paddingY="s"
                            className={styles.infoBar}
                        >
                            <Text as="p" variant="bodySmall" color="primary">
                                <Text
                                    as="span"
                                    variant="bodySmall"
                                    weight="semiBold"
                                >
                                    {t(
                                        "merchantEdit.editMerchant.infoMonerium"
                                    )}{" "}
                                </Text>
                                {t(
                                    "forms.currencySelector.moneriumDescription"
                                )}
                            </Text>
                            <Text as="p" variant="bodySmall" color="primary">
                                <Text
                                    as="span"
                                    variant="bodySmall"
                                    weight="semiBold"
                                >
                                    {t(
                                        "merchantEdit.editMerchant.infoCircle"
                                    )}{" "}
                                </Text>
                                {t("forms.currencySelector.circleDescription")}
                            </Text>
                        </Stack>
                    </form>
                </Form>
                <Inline space="s" padding="l">
                    <Button
                        variant="secondary"
                        size="large"
                        className={styles.footerButton}
                        disabled={editMerchantPending}
                        onClick={requestClose}
                    >
                        {t("merchantEdit.editMerchant.cancel")}
                    </Button>
                    <Button
                        variant="primary"
                        size="large"
                        className={styles.footerButton}
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={
                            editMerchantPending || !form.formState.isDirty
                        }
                        loading={editMerchantPending}
                    >
                        {t("merchantEdit.editMerchant.save")}
                    </Button>
                </Inline>
            </SheetContent>
            <DiscardChangesDialog {...dialogProps} />
        </Sheet>
    );
}
