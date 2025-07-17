"use client";

import { Title } from "@/module/common/component/Title";
import { useCheckDomainName } from "@/module/dashboard/hooks/dnsRecordHooks";
import { useMintMyProduct } from "@/module/dashboard/hooks/useMintMyProduct";
import type { Stablecoin } from "@frak-labs/app-essentials";
import type { ProductTypesKey } from "@frak-labs/core-sdk";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ProductInformationPanel } from "./ProductInformationPanel";
import { RegistrationPanel } from "./RegistrationPanel";
import { ValidationPanel } from "./ValidationPanel";
import { defaultProductTypes, getDefaultStablecoin } from "./utils";

type ProductNew = {
    name: string;
    domain: string;
    productTypes: ProductTypesKey[];
    setupCode: string;
    currency: Stablecoin;
};

export function MintProduct() {
    const [step, setStep] = useState(1);
    const [isDomainValid, setIsDomainValid] = useState(false);
    const [domainError, setDomainError] = useState<string | undefined>();

    const form = useForm<ProductNew>({
        defaultValues: {
            name: "",
            domain: "",
            productTypes: defaultProductTypes,
            setupCode: "",
            currency: getDefaultStablecoin(),
        },
    });
    const domain = form.watch("domain");
    const setupCode = form.watch("setupCode");

    const { mutateAsync: checkDomainSetup } = useCheckDomainName();

    const {
        mutation: {
            mutate: triggerMint,
            isPending,
            error,
            data: { mintTxHash } = {},
        },
        infoTxt,
    } = useMintMyProduct({
        onSuccess: () => {
            setStep(3);
        },
    });

    // Verify the validity of a domain
    async function verifyDomain() {
        setDomainError(undefined);
        setIsDomainValid(false);

        const isFormValid = await form.trigger();
        if (!isFormValid) return;

        if (!domain) {
            setDomainError("Invalid domain name");
            return;
        }

        try {
            const { isAlreadyMinted, isDomainValid } = await checkDomainSetup({
                domain,
                setupCode,
            });

            if (isAlreadyMinted) {
                setDomainError(
                    `A product already exists for the domain ${domain}`
                );
            } else if (!isDomainValid) {
                setDomainError(
                    "The DNS txt record is not set, or the setup code is invalid"
                );
            } else {
                setIsDomainValid(true);
            }
        } catch (err) {
            console.error("Domain verification failed:", err);
            setDomainError("Failed to verify domain");
        }
    }

    const handleSubmit = () => {
        const formData = form.getValues();
        triggerMint({
            name: formData.name,
            domain: formData.domain,
            productTypes: formData.productTypes,
            setupCode: formData.setupCode,
            currency: formData.currency,
        });
    };

    return (
        <>
            <Title>Mint New Product</Title>

            <ProductInformationPanel
                form={form}
                step={step}
                isDomainValid={isDomainValid}
                domainError={domainError}
                onVerifyDomain={verifyDomain}
            />

            <ValidationPanel
                form={form}
                step={step}
                isDomainValid={isDomainValid}
                onNext={() => setStep(2)}
            />

            <RegistrationPanel
                step={step}
                isPending={isPending}
                error={error}
                infoTxt={infoTxt}
                mintTxHash={mintTxHash}
                onSubmit={handleSubmit}
            />
        </>
    );
}
