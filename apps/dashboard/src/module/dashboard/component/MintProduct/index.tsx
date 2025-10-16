"use client";
import { Head } from "@/module/common/component/Head";
import { useCheckDomainName } from "@/module/dashboard/hooks/dnsRecordHooks";
import { useMintMyProduct } from "@/module/dashboard/hooks/useMintMyProduct";
import { FormLayout } from "@/module/forms/Form";
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
    const [domainError, setDomainError] = useState<string | undefined>();
    const [openAccordion, setOpenAccordion] = useState<string>("product-info");

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
            setStep(4);
            setOpenAccordion("registration");
        },
    });

    // Verify the validity of a domain
    async function verifyDomain() {
        const isFormValid = await form.trigger();
        if (!isFormValid) return;

        setDomainError(undefined);

        if (!domain) {
            setDomainError("Invalid domain name");
            return;
        }

        try {
            const { isAlreadyMinted, isDomainValid } = await checkDomainSetup({
                domain,
                setupCode,
            });
            setOpenAccordion("validation");

            if (isAlreadyMinted) {
                setDomainError(
                    `A product already exists for the domain ${domain}`
                );
            } else if (!isDomainValid) {
                setDomainError(
                    "The DNS txt record is not set, or the setup code is invalid"
                );
            } else {
                // Directly shift to step 2
                setStep(2);
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
        <FormLayout>
            <Head
                title={{
                    content: "Mint New Product",
                    size: "small",
                }}
            />

            <ProductInformationPanel
                form={form}
                step={step}
                domainError={domainError}
                onVerifyDomain={verifyDomain}
                isOpen={openAccordion === "product-info"}
                onOpenChange={(value: boolean) =>
                    setOpenAccordion(value ? "product-info" : "")
                }
            />

            <ValidationPanel
                form={form}
                step={step}
                onPrevious={() => {
                    setStep(1);
                    setOpenAccordion("product-info");
                }}
                onNext={() => {
                    setStep(3);
                    setOpenAccordion("registration");
                }}
                isOpen={openAccordion === "validation"}
                onOpenChange={(value: boolean) =>
                    setOpenAccordion(value ? "validation" : "")
                }
            />

            <RegistrationPanel
                step={step}
                isPending={isPending}
                error={error}
                infoTxt={infoTxt}
                mintTxHash={mintTxHash}
                onSubmit={handleSubmit}
                isOpen={openAccordion === "registration"}
                onOpenChange={(value: boolean) =>
                    setOpenAccordion(value ? "registration" : "")
                }
            />
        </FormLayout>
    );
}
