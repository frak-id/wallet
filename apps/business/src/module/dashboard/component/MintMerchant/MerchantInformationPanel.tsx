import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@frak-labs/ui/component/Accordion";
import { Button } from "@frak-labs/ui/component/Button";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { TextWithCopy } from "@frak-labs/ui/component/TextWithCopy";
import { validateUrl } from "@frak-labs/ui/utils/validateUrl";
import { CheckCircle2, ExternalLink, XCircle } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { PanelAccordion } from "@/module/common/component/PanelAccordion";
import { useDnsTxtRecordToSet } from "@/module/dashboard/hooks/dnsRecordHooks";
import { CurrencySelector } from "@/module/forms/CurrencySelector";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/module/forms/Form";
import type { MerchantNew } from "@/types/Merchant";
import styles from "./index.module.css";

interface MerchantInformationPanelProps {
    form: UseFormReturn<MerchantNew>;
    step: number;
    domainError?: string;
    onVerifyDomain: () => void;
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
}

export function MerchantInformationPanel({
    form,
    step,
    domainError,
    onVerifyDomain,
    isOpen,
    onOpenChange,
}: MerchantInformationPanelProps) {
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
            title="Merchant Information"
            className={styles.panel}
            withBadge={step > 1}
            value={isOpen ? "item-1" : ""}
            onValueChange={(value) => onOpenChange(value === "item-1")}
        >
            <Form {...form}>
                <form className={styles.form}>
                    <FormField
                        control={form.control}
                        name="name"
                        rules={{
                            required: "Merchant name is required",
                            minLength: {
                                value: 2,
                                message:
                                    "Merchant name must be at least 2 characters",
                            },
                        }}
                        render={({ field }) => (
                            <FormItem className={styles.nameField}>
                                <FormLabel weight="medium">
                                    Enter a Merchant Name
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        length="medium"
                                        placeholder="Merchant Name..."
                                        disabled={step > 1}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

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

/**
 * @deprecated Use MerchantInformationPanel instead
 */
export const ProductInformationPanel = MerchantInformationPanel;
