import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Head } from "@/module/common/component/Head";
import { useCheckDomainName } from "@/module/dashboard/hooks/dnsRecordHooks";
import { useRegisterMerchant } from "@/module/dashboard/hooks/useMintMyMerchant";
import { getDefaultStablecoin } from "@/module/dashboard/utils/mintUtils";
import { FormLayout } from "@/module/forms/Form";
import type { MerchantNew } from "@/types/Merchant";
import { MerchantInformationPanel } from "./MerchantInformationPanel";
import { RegistrationPanel } from "./RegistrationPanel";
import { ValidationPanel } from "./ValidationPanel";

export function MintMerchant() {
    const [step, setStep] = useState(1);
    const [domainError, setDomainError] = useState<string | undefined>();
    const [openAccordion, setOpenAccordion] = useState<string>("product-info");

    const form = useForm<MerchantNew>({
        defaultValues: {
            name: "",
            domain: "",
            setupCode: "",
            currency: "eure",
        },
    });
    const domain = form.watch("domain");
    const setupCode = form.watch("setupCode");

    useEffect(() => {
        const defaultCurrency = getDefaultStablecoin();
        if (
            form.getValues("currency") === "eure" &&
            defaultCurrency !== "eure"
        ) {
            form.setValue("currency", defaultCurrency);
        }
    }, [form]);

    const { mutateAsync: checkDomainSetup } = useCheckDomainName();

    const {
        mutation: {
            mutate: triggerMint,
            isPending,
            error,
            data: { merchantId } = {},
        },
        infoTxt,
    } = useRegisterMerchant({
        onSuccess: () => {
            setStep(4);
            setOpenAccordion("registration");
        },
    });

    async function verifyDomain() {
        const isFormValid = await form.trigger();
        if (!isFormValid) return;

        setDomainError(undefined);

        if (!domain) {
            setDomainError("Invalid domain name");
            return;
        }

        try {
            const { isAlreadyRegistered, isDomainValid } =
                await checkDomainSetup({
                    domain,
                    setupCode,
                });
            setOpenAccordion("validation");

            if (isAlreadyRegistered) {
                setDomainError(
                    `A merchant already exists for the domain ${domain}`
                );
            } else if (!isDomainValid) {
                setDomainError(
                    "The DNS txt record is not set, or the setup code is invalid"
                );
            } else {
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
            setupCode: formData.setupCode,
            currency: formData.currency,
        });
    };

    return (
        <FormLayout>
            <Head
                title={{
                    content: "Register New Merchant",
                    size: "small",
                }}
            />

            <MerchantInformationPanel
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
                merchantId={merchantId}
                onSubmit={handleSubmit}
                isOpen={openAccordion === "registration"}
                onOpenChange={(value: boolean) =>
                    setOpenAccordion(value ? "registration" : "")
                }
            />
        </FormLayout>
    );
}

/**
 * @deprecated Use MintMerchant instead
 */
export const MintProduct = MintMerchant;
