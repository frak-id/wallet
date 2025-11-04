import type { ProductTypesKey } from "@frak-labs/core-sdk";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/ui/component/Accordion";
import { Button } from "@frak-labs/ui/component/Button";
import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { TextWithCopy } from "@frak-labs/ui/component/TextWithCopy";
import { validateUrl } from "@frak-labs/ui/utils/validateUrl";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { useDnsTxtRecordToSet } from "@/module/dashboard/hooks/dnsRecordHooks";
import { productTypeDescriptions } from "@/module/dashboard/utils/mintUtils";
import { CurrencySelector } from "@/module/forms/CurrencySelector";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { ProductNew } from "@/types/Product";
import styles from "./index.module.css";

interface ProductInformationPanelProps {
    form: UseFormReturn<ProductNew>;
    step: number;
    domainError?: string;
    onVerifyDomain: () => void;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

function ProductTypeCard({
    info,
    isChecked,
    disabled,
    onChange,
}: {
    info: {
        name: string;
        description: string;
        useCase: string;
        events: string[];
    };
    isChecked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label
            className={styles.productTypeCard}
            htmlFor={`checkbox-${info.name}`}
        >
            <div className={styles.productTypeLabel}>
                <div>
                    <Checkbox
                        checked={isChecked}
                        disabled={disabled}
                        onCheckedChange={onChange}
                        id={`checkbox-${info.name}`}
                    />
                </div>
                <div className={styles.productTypeInfo}>
                    <h4>{info.name}</h4>
                    <p className={styles.productTypeDescription}>
                        {info.description}
                    </p>
                    <p className={styles.productTypeUseCase}>{info.useCase}</p>
                    {info.events.length > 0 && (
                        <div className={styles.productTypeEvents}>
                            <span className={styles.productTypeEventsLabel}>
                                Trackable events:
                            </span>
                            <ul className={styles.productTypeEventsList}>
                                {info.events.map((event) => (
                                    <li key={event}>{event}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </label>
    );
}

export function ProductInformationPanel({
    form,
    step,
    domainError,
    onVerifyDomain,
    isOpen,
    onOpenChange,
}: ProductInformationPanelProps) {
    const domain = form.watch("domain");
    const domainFieldState = form.getFieldState("domain");

    const isDomainValid =
        domain &&
        validateUrl(domain) &&
        !domainError &&
        !domainFieldState.invalid;
    const isDomainInvalid =
        (domain && !validateUrl(domain)) ||
        !!domainError ||
        domainFieldState.invalid;

    const { data: dnsRecord, isLoading: isDnsLoading } = useDnsTxtRecordToSet({
        domain,
        enabled: !!domain,
    });

    return (
        <PanelAccordion
            title="Product Information"
            className={styles.panel}
            withBadge={step > 1}
            value={isOpen ? "item-1" : ""}
            onValueChange={(value) => onOpenChange(value === "item-1")}
        >
            <Form {...form}>
                <form className={styles.form}>
                    {/* Product Name */}
                    <FormField
                        control={form.control}
                        name="name"
                        rules={{
                            required: "Product name is required",
                            minLength: {
                                value: 2,
                                message:
                                    "Product name must be at least 2 characters",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem className={styles.nameField}>
                                <FormLabel weight="medium">
                                    Enter a Product Name
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        length="medium"
                                        placeholder="Product Name..."
                                        disabled={step > 1}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Currency */}
                    <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                            <FormItem className={styles.currencyField}>
                                <FormLabel weight="medium">Currency</FormLabel>
                                <p className={styles.currencyDescription}>
                                    The default currency for your campaigns
                                </p>
                                <FormControl>
                                    <CurrencySelector
                                        value={field.value}
                                        onChange={field.onChange}
                                        disabled={step > 1}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Mandatory Configuration */}
                    <div className={styles.mandatorySection}>
                        <FormLabel weight="medium">
                            Mandatory Configuration
                        </FormLabel>
                        <p className={styles.mandatorySectionDescription}>
                            The following feature is always enabled as it's
                            required for reward distribution:
                        </p>
                        <div className={styles.mandatoryCard}>
                            <div className={styles.mandatoryCardContent}>
                                <h4>Referral Tracking</h4>
                                <p className={styles.mandatoryCardDescription}>
                                    Tracks user referral activities and enables
                                    reward distribution. This is the foundation
                                    of all campaigns on Frak.
                                </p>
                                <div className={styles.mandatoryEvents}>
                                    <span
                                        className={styles.mandatoryEventsLabel}
                                    >
                                        Trackable events:
                                    </span>
                                    <ul className={styles.mandatoryEventsList}>
                                        {productTypeDescriptions.referral.events.map(
                                            (event) => (
                                                <li key={event}>{event}</li>
                                            )
                                        )}
                                    </ul>
                                </div>
                            </div>
                            <div className={styles.mandatoryBadge}>
                                Always Active
                            </div>
                        </div>
                    </div>

                    {/* Product Types */}
                    <FormField
                        control={form.control}
                        name="productTypes"
                        rules={{
                            required: "Please select at least one product type",
                            validate: (value) =>
                                value.length > 0 ||
                                "At least one product type must be selected",
                        }}
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel weight="medium">
                                    Product Types
                                </FormLabel>
                                <p className={styles.productTypesDescription}>
                                    Select the events you want to track on your
                                    platform. These determine what user actions
                                    you can reward through your campaigns. For
                                    example, selecting "Purchase" allows you to
                                    track purchases and create campaigns that
                                    reward users based on purchase activity.
                                </p>
                                <div className={styles.productTypesGrid}>
                                    {Object.entries(productTypeDescriptions)
                                        .filter(([key]) => key !== "referral")
                                        .map(([key, info]) => {
                                            const productType =
                                                key as ProductTypesKey;
                                            const isChecked =
                                                field.value.includes(
                                                    productType
                                                );

                                            return (
                                                <ProductTypeCard
                                                    key={key}
                                                    info={info}
                                                    isChecked={isChecked}
                                                    disabled={step > 1}
                                                    onChange={(checked) => {
                                                        if (checked) {
                                                            field.onChange([
                                                                ...field.value,
                                                                productType,
                                                            ]);
                                                        } else {
                                                            field.onChange(
                                                                field.value.filter(
                                                                    (type) =>
                                                                        type !==
                                                                        productType
                                                                )
                                                            );
                                                        }
                                                    }}
                                                />
                                            );
                                        })}
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Domain and Setup Code Section */}
                    <div className={styles.domainSection}>
                        <FormLabel weight="medium">
                            Domain Configuration
                        </FormLabel>

                        <div className={styles.domainFields}>
                            <FormField
                                control={form.control}
                                name="domain"
                                rules={{
                                    required: "Domain name is required",
                                    validate: (value) =>
                                        validateUrl(value) ||
                                        "Please enter a valid domain (e.g., example.com)",
                                }}
                                render={({ field }) => (
                                    <FormItem className={styles.domainField}>
                                        <FormLabel weight="medium">
                                            Domain Name
                                        </FormLabel>
                                        <FormControl>
                                            <div
                                                className={
                                                    styles.domainInputWrapper
                                                }
                                            >
                                                <Input
                                                    length="medium"
                                                    placeholder="example.com"
                                                    disabled={step > 1}
                                                    {...field}
                                                />
                                                {isDomainValid &&
                                                    step === 1 && (
                                                        <CheckCircle2
                                                            className={
                                                                styles.domainValidIcon
                                                            }
                                                            size={20}
                                                        />
                                                    )}
                                                {isDomainInvalid &&
                                                    step === 1 && (
                                                        <XCircle
                                                            className={
                                                                styles.domainInvalidIcon
                                                            }
                                                            size={20}
                                                        />
                                                    )}
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="setupCode"
                                render={({ field }) => (
                                    <FormItem className={styles.setupCodeField}>
                                        <FormLabel weight="medium">
                                            Setup Code (optional)
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                length="medium"
                                                placeholder="Setup code..."
                                                disabled={step > 1}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {domainError && (
                            <FormMessage>{domainError}</FormMessage>
                        )}

                        {(dnsRecord || isDnsLoading) && (
                            <div className={styles.dnsSection}>
                                <FormLabel weight="medium">
                                    DNS TXT Record Required
                                </FormLabel>
                                <p className={styles.dnsDescription}>
                                    Add this TXT record to your domain's DNS
                                    settings:
                                </p>
                                {isDnsLoading ? (
                                    <Spinner />
                                ) : (
                                    <TextWithCopy text={dnsRecord}>
                                        <pre className={styles.dnsRecord}>
                                            {dnsRecord}
                                        </pre>
                                    </TextWithCopy>
                                )}

                                <Accordion
                                    type="single"
                                    collapsible
                                    className={styles.dnsHelpAccordion}
                                >
                                    <AccordionItem value="dns-help">
                                        <AccordionTrigger
                                            className={styles.dnsHelpTrigger}
                                        >
                                            How to add a DNS TXT record in my
                                            DNS settings?
                                        </AccordionTrigger>
                                        <AccordionContent
                                            className={styles.dnsHelpContent}
                                        >
                                            <p>
                                                Adding a DNS TXT record verifies
                                                that you own this domain. The
                                                process varies depending on your
                                                DNS provider (e.g., Cloudflare,
                                                GoDaddy, Namecheap).
                                            </p>
                                            <p>
                                                For detailed step-by-step
                                                instructions, please visit our
                                                documentation:
                                            </p>
                                            <a
                                                href="https://docs.frak.id/business/product/verify"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className={styles.dnsHelpLink}
                                            >
                                                View DNS Setup Guide
                                                <ExternalLink size={14} />
                                            </a>
                                        </AccordionContent>
                                    </AccordionItem>
                                </Accordion>
                            </div>
                        )}
                    </div>

                    <div className={styles.continueSection}>
                        <Button
                            variant="information"
                            onClick={onVerifyDomain}
                            type="button"
                            disabled={step > 1}
                            className={styles.continueButton}
                        >
                            Continue
                        </Button>
                    </div>
                </form>
            </Form>
        </PanelAccordion>
    );
}
