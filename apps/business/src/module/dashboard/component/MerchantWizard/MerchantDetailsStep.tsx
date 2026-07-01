import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/design-system/components/Accordion";
import { Box } from "@frak-labs/design-system/components/Box";
import { button } from "@frak-labs/design-system/components/Button";
import { FieldError } from "@frak-labs/design-system/components/FieldError";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Switch } from "@frak-labs/design-system/components/Switch";
import { Text } from "@frak-labs/design-system/components/Text";
import { CheckIcon, CopyIcon } from "@frak-labs/design-system/icons";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { shouldShowError } from "@/module/campaigns/component/Creation/fieldError";
import { WizardFieldCard } from "@/module/campaigns/component/Creation/WizardFieldCard";
import { useCopyToClipboardWithState } from "@/module/common/hook/useCopyToClipboardWithState";
import { validateUrl } from "@/module/common/utils/validateUrl";
import { useDnsTxtRecordToSet } from "@/module/dashboard/hooks/dnsRecordHooks";
import { FormControl, FormField, FormItem } from "@/module/forms/Form";
import { Input } from "@/module/forms/Input";
import { InputNumber } from "@/module/forms/InputNumber";
import type { MerchantNew } from "@/types/Merchant";
import { MerchantCurrencyField } from "./MerchantCurrencyField";
import * as styles from "./merchantWizard.css";

const DOCS_URL = "https://docs.frak.id/business/product/verify";

export function MerchantDetailsStep({
    domainError,
    isPlatformAdmin = false,
}: {
    domainError?: string;
    isPlatformAdmin?: boolean;
}) {
    const { t } = useTranslation();
    const { control, watch } = useFormContext<MerchantNew>();
    const domain = watch("domain");
    const skipDomainValidation = watch("skipDomainValidation");
    const { copied, copy } = useCopyToClipboardWithState();

    const { data: dnsRecord, isLoading: isDnsLoading } = useDnsTxtRecordToSet({
        domain,
        enabled: !!domain,
    });

    return (
        <Stack space="l">
            <WizardFieldCard
                insetLabel
                space="xs"
                label={t("merchant.create.fields.name.label")}
            >
                <FormField
                    control={control}
                    name="name"
                    rules={{
                        required: t("merchant.create.fields.name.required"),
                        minLength: {
                            value: 2,
                            message: t("merchant.create.fields.name.minLength"),
                        },
                    }}
                    render={({ field, fieldState }) => {
                        const showError = shouldShowError(fieldState);
                        return (
                            <FormItem>
                                <Stack space="xxs">
                                    <FormControl>
                                        <Input
                                            variant="bare"
                                            tone="muted"
                                            error={showError}
                                            placeholder={t(
                                                "merchant.create.fields.name.placeholder"
                                            )}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FieldError>
                                        {showError
                                            ? fieldState.error?.message
                                            : null}
                                    </FieldError>
                                </Stack>
                            </FormItem>
                        );
                    }}
                />
            </WizardFieldCard>

            <WizardFieldCard
                space="none"
                label={t("merchant.create.fields.currency.label")}
                description={t("merchant.create.fields.currency.description")}
            >
                <FormField
                    control={control}
                    name="currency"
                    render={({ field }) => (
                        <MerchantCurrencyField
                            value={field.value}
                            onChange={field.onChange}
                        />
                    )}
                />
            </WizardFieldCard>

            <div className={styles.infoBar}>
                <Stack space="m">
                    <Text variant="bodySmall">
                        <Text as="span" variant="bodySmall" weight="semiBold">
                            {t("merchant.create.currencyInfo.moneriumName")}
                        </Text>{" "}
                        {t("merchant.create.currencyInfo.moneriumDescription")}
                    </Text>
                    <Text variant="bodySmall">
                        <Text as="span" variant="bodySmall" weight="semiBold">
                            {t("merchant.create.currencyInfo.circleName")}
                        </Text>{" "}
                        {t("merchant.create.currencyInfo.circleDescription")}
                    </Text>
                </Stack>
            </div>

            {isPlatformAdmin && (
                <WizardFieldCard
                    label={t("merchant.create.platformAdmin.label")}
                    description={t("merchant.create.platformAdmin.description")}
                >
                    <Stack space="m">
                        <FormField
                            control={control}
                            name="skipDomainValidation"
                            render={({ field }) => (
                                <FormItem>
                                    <Inline
                                        space="m"
                                        align="space-between"
                                        alignY="center"
                                        wrap={false}
                                    >
                                        <Stack space="xxs">
                                            <Text
                                                variant="body"
                                                weight="medium"
                                            >
                                                {t(
                                                    "merchant.create.platformAdmin.skipDomain.title"
                                                )}
                                            </Text>
                                            <Text
                                                variant="bodySmall"
                                                color="secondary"
                                            >
                                                {t(
                                                    "merchant.create.platformAdmin.skipDomain.description"
                                                )}
                                            </Text>
                                        </Stack>
                                        <FormControl>
                                            <Switch
                                                checked={!!field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </Inline>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="useFrakBank"
                            render={({ field }) => (
                                <FormItem>
                                    <Inline
                                        space="m"
                                        align="space-between"
                                        alignY="center"
                                        wrap={false}
                                    >
                                        <Stack space="xxs">
                                            <Text
                                                variant="body"
                                                weight="medium"
                                            >
                                                {t(
                                                    "merchant.create.platformAdmin.useFrakBank.title"
                                                )}
                                            </Text>
                                            <Text
                                                variant="bodySmall"
                                                color="secondary"
                                            >
                                                {t(
                                                    "merchant.create.platformAdmin.useFrakBank.description"
                                                )}
                                            </Text>
                                        </Stack>
                                        <FormControl>
                                            <Switch
                                                checked={!!field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </Inline>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={control}
                            name="takeadsMerchantId"
                            rules={{
                                validate: (value) => {
                                    // `InputNumber` can hand back `""` (untyped
                                    // at the RHF level as `number`) while the
                                    // user is clearing/editing the field.
                                    if (value === undefined || value === null)
                                        return true;
                                    const isEmptyString =
                                        typeof value === "string" &&
                                        value === "";
                                    if (isEmptyString) return true;
                                    return (
                                        (Number.isInteger(value) &&
                                            value > 0) ||
                                        t(
                                            "merchant.create.platformAdmin.takeadsMerchantId.mustBeInteger"
                                        )
                                    );
                                },
                            }}
                            render={({ field, fieldState }) => {
                                const showError = shouldShowError(fieldState);
                                return (
                                    <FormItem>
                                        <Stack space="xxs">
                                            <Text
                                                variant="bodySmall"
                                                weight="medium"
                                                color="secondary"
                                                className={styles.inputLabel}
                                            >
                                                {t(
                                                    "merchant.create.platformAdmin.takeadsMerchantId.label"
                                                )}
                                            </Text>
                                            <FormControl>
                                                <InputNumber
                                                    variant="bare"
                                                    tone="muted"
                                                    inputMode="numeric"
                                                    step="1"
                                                    error={showError}
                                                    placeholder={t(
                                                        "merchant.create.platformAdmin.takeadsMerchantId.placeholder"
                                                    )}
                                                    {...field}
                                                    value={field.value ?? ""}
                                                />
                                            </FormControl>
                                            <FieldError>
                                                {showError
                                                    ? fieldState.error?.message
                                                    : null}
                                            </FieldError>
                                        </Stack>
                                    </FormItem>
                                );
                            }}
                        />
                        <FormField
                            control={control}
                            name="takeadsTrackingLink"
                            rules={{
                                validate: (value) => {
                                    if (!value) return true;
                                    return (
                                        validateUrl(value) ||
                                        t(
                                            "merchant.create.platformAdmin.takeadsTrackingLink.invalidUrl"
                                        )
                                    );
                                },
                            }}
                            render={({ field, fieldState }) => {
                                const showError = shouldShowError(fieldState);
                                return (
                                    <FormItem>
                                        <Stack space="xxs">
                                            <Text
                                                variant="bodySmall"
                                                weight="medium"
                                                color="secondary"
                                                className={styles.inputLabel}
                                            >
                                                {t(
                                                    "merchant.create.platformAdmin.takeadsTrackingLink.label"
                                                )}
                                            </Text>
                                            <FormControl>
                                                <Input
                                                    variant="bare"
                                                    tone="muted"
                                                    error={showError}
                                                    placeholder={t(
                                                        "merchant.create.platformAdmin.takeadsTrackingLink.placeholder"
                                                    )}
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FieldError>
                                                {showError
                                                    ? fieldState.error?.message
                                                    : null}
                                            </FieldError>
                                        </Stack>
                                    </FormItem>
                                );
                            }}
                        />
                    </Stack>
                </WizardFieldCard>
            )}

            <WizardFieldCard label={t("merchant.create.fields.domain.label")}>
                <Stack space="m">
                    <FormField
                        control={control}
                        name="domain"
                        rules={{
                            required: t(
                                "merchant.create.fields.domain.required"
                            ),
                            validate: (value) =>
                                validateUrl(value) ||
                                t("merchant.create.fields.domain.invalid"),
                        }}
                        render={({ field, fieldState }) => {
                            const showError = shouldShowError(fieldState);
                            return (
                                <FormItem>
                                    <Stack space="xxs">
                                        <Text
                                            variant="bodySmall"
                                            weight="medium"
                                            color="secondary"
                                            className={styles.inputLabel}
                                        >
                                            {t(
                                                "merchant.create.fields.domain.nameLabel"
                                            )}
                                        </Text>
                                        <FormControl>
                                            <Input
                                                variant="bare"
                                                tone="muted"
                                                error={showError}
                                                placeholder="example.com"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FieldError>
                                            {showError
                                                ? fieldState.error?.message
                                                : null}
                                        </FieldError>
                                    </Stack>
                                </FormItem>
                            );
                        }}
                    />

                    <FormField
                        control={control}
                        name="setupCode"
                        render={({ field }) => (
                            <FormItem>
                                <Stack space="xxs">
                                    <Text
                                        variant="bodySmall"
                                        weight="medium"
                                        color="secondary"
                                        className={styles.inputLabel}
                                    >
                                        {t(
                                            "merchant.create.fields.setupCode.label"
                                        )}
                                    </Text>
                                    <FormControl>
                                        <Input
                                            variant="bare"
                                            tone="muted"
                                            placeholder={t(
                                                "merchant.create.fields.setupCode.placeholder"
                                            )}
                                            {...field}
                                        />
                                    </FormControl>
                                </Stack>
                            </FormItem>
                        )}
                    />

                    {domainError && <FieldError>{domainError}</FieldError>}

                    {!skipDomainValidation && (dnsRecord || isDnsLoading) && (
                        <Stack space="m" className={styles.dnsBlock}>
                            <Text
                                variant="bodySmall"
                                weight="medium"
                                color="secondary"
                            >
                                {t("merchant.create.dns.title")}
                            </Text>
                            <Stack space="none" className={styles.dnsRecordBox}>
                                <Box paddingY="m">
                                    <Text
                                        variant="bodySmall"
                                        weight="medium"
                                        color="secondary"
                                    >
                                        {t("merchant.create.dns.helper")}
                                    </Text>
                                </Box>
                                <Inline
                                    space="xs"
                                    alignY="center"
                                    wrap={false}
                                    className={styles.dnsRecordRow}
                                >
                                    {isDnsLoading ? (
                                        <Spinner />
                                    ) : (
                                        <>
                                            <Text
                                                variant="bodySmall"
                                                className={
                                                    styles.dnsRecordValue
                                                }
                                            >
                                                {dnsRecord}
                                            </Text>
                                            <button
                                                type="button"
                                                className={styles.dnsCopyButton}
                                                aria-label={t(
                                                    "merchant.create.dns.copy"
                                                )}
                                                onClick={() =>
                                                    dnsRecord && copy(dnsRecord)
                                                }
                                            >
                                                {copied ? (
                                                    <CheckIcon
                                                        width={16}
                                                        height={16}
                                                    />
                                                ) : (
                                                    <CopyIcon
                                                        width={16}
                                                        height={16}
                                                    />
                                                )}
                                            </button>
                                        </>
                                    )}
                                </Inline>
                            </Stack>
                            <Accordion
                                type="single"
                                collapsible
                                className={styles.dnsHelpBox}
                            >
                                <AccordionItem
                                    value="dns-help"
                                    className={styles.dnsHelpItem}
                                >
                                    <AccordionTrigger
                                        className={styles.dnsHelpTrigger}
                                    >
                                        {t("merchant.create.dns.helpQuestion")}
                                    </AccordionTrigger>
                                    <AccordionContent
                                        className={styles.dnsHelpContent}
                                    >
                                        <Stack space="m">
                                            <Text
                                                variant="body"
                                                color="secondary"
                                            >
                                                {t(
                                                    "merchant.create.dns.helpBody"
                                                )}
                                            </Text>
                                            <a
                                                href={DOCS_URL}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={`${button({ variant: "secondary", size: "small", width: "auto" })} ${styles.dnsHelpLink}`}
                                            >
                                                {t(
                                                    "merchant.create.dns.helpCta"
                                                )}
                                            </a>
                                        </Stack>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </Stack>
                    )}
                </Stack>
            </WizardFieldCard>
        </Stack>
    );
}
