"use client";

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
import type { ProductNew } from "@/types/Product";
import type { ProductTypesKey } from "@frak-labs/core-sdk";
import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { TextWithCopy } from "@frak-labs/ui/component/TextWithCopy";
import { Checkbox } from "@frak-labs/ui/component/forms/Checkbox";
import { Input } from "@frak-labs/ui/component/forms/Input";
import { validateUrl } from "@frak-labs/ui/utils/validateUrl";
import type { UseFormReturn } from "react-hook-form";
import styles from "./index.module.css";
import { productTypeDescriptions } from "./utils";

interface ProductInformationPanelProps {
    form: UseFormReturn<ProductNew>;
    step: number;
    domainError?: string;
    onVerifyDomain: () => void;
}

function ProductTypeCard({
    info,
    isChecked,
    disabled,
    onChange,
}: {
    info: { name: string; description: string; useCase: string };
    isChecked: boolean;
    disabled?: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label
            className={styles.productTypeCard}
            style={{ cursor: disabled ? "not-allowed" : "pointer" }}
            htmlFor={`checkbox-${info.name}`}
        >
            <div className={styles.productTypeLabel}>
                <Checkbox
                    checked={isChecked}
                    disabled={disabled}
                    onCheckedChange={onChange}
                    id={`checkbox-${info.name}`}
                />
                <div className={styles.productTypeInfo}>
                    <h4>{info.name}</h4>
                    <p className={styles.productTypeDescription}>
                        {info.description}
                    </p>
                    <p className={styles.productTypeUseCase}>{info.useCase}</p>
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
}: ProductInformationPanelProps) {
    const domain = form.watch("domain");

    const { data: dnsRecord, isLoading: isDnsLoading } = useDnsTxtRecordToSet({
        domain,
        enabled: !!domain,
    });

    return (
        <PanelAccordion
            title="Product Information"
            className={styles.panel}
            withBadge={step > 1}
            value={step === 1 ? "item-1" : undefined}
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
                                <div className={styles.productTypesGrid}>
                                    {Object.entries(
                                        productTypeDescriptions
                                    ).map(([key, info]) => {
                                        const productType =
                                            key as ProductTypesKey;
                                        const isChecked =
                                            field.value.includes(productType);

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
                                            <Input
                                                length="medium"
                                                placeholder="example.com"
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
