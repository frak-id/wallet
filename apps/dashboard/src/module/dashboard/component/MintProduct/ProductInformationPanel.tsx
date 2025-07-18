import { Panel } from "@/module/common/component/Panel";
import { useDnsTxtRecordToSet } from "@/module/dashboard/hooks/dnsRecordHooks";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormValidMessage,
} from "@/module/forms/Form";
import { currencyOptions } from "@/module/product/utils/currencyOptions";
import type { Stablecoin } from "@frak-labs/app-essentials";
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

type ProductNew = {
    name: string;
    domain: string;
    productTypes: ProductTypesKey[];
    setupCode: string;
    currency: Stablecoin;
};

interface ProductInformationPanelProps {
    form: UseFormReturn<ProductNew>;
    step: number;
    isDomainValid: boolean;
    domainError?: string;
    onVerifyDomain: () => void;
}

interface CompletedProductInfoProps {
    values: ProductNew;
}

function CompletedProductInfo({ values }: CompletedProductInfoProps) {
    return (
        <div className={styles.lockedContent}>
            <p>Product information completed for {values.name}</p>
            <p>Domain: {values.domain}</p>
            <p>Currency: {values.currency.toUpperCase()}</p>
            <p>Product Types: {values.productTypes.join(", ")}</p>
        </div>
    );
}

function ProductTypeCard({
    info,
    isChecked,
    onChange,
}: {
    info: { name: string; description: string; useCase: string };
    isChecked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label
            className={styles.productTypeCard}
            style={{ cursor: "pointer" }}
            htmlFor={`checkbox-${info.name}`}
        >
            <div className={styles.productTypeLabel}>
                <Checkbox
                    checked={isChecked}
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
    isDomainValid,
    domainError,
    onVerifyDomain,
}: ProductInformationPanelProps) {
    const domain = form.watch("domain");

    const { data: dnsRecord, isLoading: isDnsLoading } = useDnsTxtRecordToSet({
        domain,
        enabled: !!domain,
    });

    if (step > 1) {
        return (
            <Panel
                title="Product Information"
                className={`${styles.panel} ${styles.panelLocked}`}
            >
                <CompletedProductInfo values={form.getValues()} />
            </Panel>
        );
    }

    return (
        <Panel title="Product Information" className={styles.panel}>
            <Form {...form}>
                <form className={styles.form}>
                    {/* Product Name and Currency */}
                    <div className={styles.nameAndCurrencyRow}>
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
                                    <FormLabel weight="medium">
                                        Currency
                                    </FormLabel>
                                    <p className={styles.currencyDescription}>
                                        The default currency for your campaigns
                                    </p>
                                    <FormControl>
                                        <select
                                            {...field}
                                            className={styles.select}
                                        >
                                            {currencyOptions.map((group) => (
                                                <optgroup
                                                    key={group.group}
                                                    label={`${group.group} - ${group.description}`}
                                                >
                                                    {group.options.map(
                                                        (option) => (
                                                            <option
                                                                key={
                                                                    option.value
                                                                }
                                                                value={
                                                                    option.value
                                                                }
                                                            >
                                                                {option.label}
                                                            </option>
                                                        )
                                                    )}
                                                </optgroup>
                                            ))}
                                        </select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {isDomainValid && (
                            <FormValidMessage>
                                Your domain name was successfully verified
                            </FormValidMessage>
                        )}
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
                            className={styles.continueButton}
                        >
                            {isDomainValid ? "Continue" : "Verify Information"}
                        </Button>
                    </div>
                </form>
            </Form>
        </Panel>
    );
}
