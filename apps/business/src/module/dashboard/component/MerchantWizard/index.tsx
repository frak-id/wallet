import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import type { StepperStep } from "@frak-labs/design-system/components/Stepper";
import {
    ArrowLeftIcon,
    CloseIcon,
    FaceIdIcon,
} from "@frak-labs/design-system/icons";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { WizardLayout } from "@/module/common/component/WizardLayout";
import { useCheckDomainName } from "@/module/dashboard/hooks/dnsRecordHooks";
import { useRegisterMerchant } from "@/module/dashboard/hooks/useMintMyMerchant";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import { Form } from "@/module/forms/Form";
import type { MerchantNew } from "@/types/Merchant";
import { MerchantDetailsStep } from "./MerchantDetailsStep";
import { MerchantRegistrationStep } from "./MerchantRegistrationStep";

/** Links the sticky-footer Continue button to the step-1 form it submits. */
const FORM_ID = "merchant-details-form";

export function MerchantWizard() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [step, setStep] = useState<1 | 2>(1);
    const [domainError, setDomainError] = useState<string | undefined>();
    const { isPlatformAdmin } = useMyMerchants();

    const form = useForm<MerchantNew>({
        defaultValues: {
            name: "",
            domain: "",
            setupCode: "",
            currency: "eure",
            skipDomainValidation: false,
            useFrakBank: false,
            takeadsMerchantId: undefined,
            takeadsTrackingLink: "",
        },
        mode: "onChange",
    });

    const { mutateAsync: checkDomain, isPending: isChecking } =
        useCheckDomainName();

    const {
        mutation: { mutate: triggerMint, isPending: isRegistering, error },
        infoTxt,
    } = useRegisterMerchant({
        // Refetch the merchant list before navigating: the `/m/$merchantId`
        // guard reads it via `ensureQueryData` (cached, no auto-refetch), so
        // the new merchant must be in cache or the guard bounces away.
        onSuccess: async (data) => {
            await queryClient.invalidateQueries({
                queryKey: ["merchant"],
                refetchType: "all",
            });
            navigate({
                to: "/m/$merchantId/dashboard",
                params: { merchantId: data.merchantId },
            });
        },
    });

    const steps: StepperStep[] = [
        {
            title: t("merchant.create.steps.details.label"),
            description: t("merchant.create.steps.details.hint"),
        },
        {
            title: t("merchant.create.steps.registration.label"),
            description: t("merchant.create.steps.registration.hint"),
        },
    ];

    const onContinue = form.handleSubmit(async (values) => {
        try {
            const { isAlreadyRegistered, isDomainValid } = await checkDomain({
                domain: values.domain,
                setupCode: values.setupCode,
            });
            if (isAlreadyRegistered) {
                setDomainError(
                    t("merchant.create.fields.domain.alreadyRegistered", {
                        domain: values.domain,
                    })
                );
                return;
            }
            // Platform admins may skip the DNS ownership check entirely.
            if (!values.skipDomainValidation && !isDomainValid) {
                setDomainError(t("merchant.create.fields.domain.dnsNotSet"));
                return;
            }
            setDomainError(undefined);
            setStep(2);
        } catch {
            setDomainError(t("merchant.create.fields.domain.verifyFailed"));
        }
    });

    const onRegister = () => {
        const values = form.getValues();
        triggerMint({
            name: values.name,
            domain: values.domain,
            setupCode: values.setupCode,
            currency: values.currency,
            skipDomainValidation: values.skipDomainValidation,
            useFrakBank: values.useFrakBank,
            // Only link a TakeAds brand when both values are provided.
            takeads:
                values.takeadsMerchantId && values.takeadsTrackingLink
                    ? {
                          takeadsMerchantId: values.takeadsMerchantId,
                          trackingLink: values.takeadsTrackingLink,
                      }
                    : undefined,
        });
    };

    if (step === 1) {
        return (
            <WizardLayout
                steps={steps}
                activeStep={0}
                title={t("merchant.create.steps.details.title")}
                description={t("merchant.create.steps.details.subtitle")}
                headerLeading={
                    <GlassButton
                        as="button"
                        aria-label={t("merchant.create.actions.close")}
                        icon={<CloseIcon width={22} height={22} />}
                        onClick={() => navigate({ to: "/dashboard" })}
                    />
                }
                footer={
                    <Button
                        type="submit"
                        form={FORM_ID}
                        variant="primary"
                        size="large"
                        loading={isChecking}
                        disabled={!form.formState.isValid || isChecking}
                    >
                        {t("merchant.create.actions.continue")}
                    </Button>
                }
            >
                <Form {...form}>
                    <form id={FORM_ID} onSubmit={onContinue}>
                        <MerchantDetailsStep
                            domainError={domainError}
                            isPlatformAdmin={isPlatformAdmin}
                        />
                    </form>
                </Form>
            </WizardLayout>
        );
    }

    return (
        <WizardLayout
            steps={steps}
            activeStep={1}
            title={t("merchant.create.steps.registration.title")}
            description={t("merchant.create.steps.registration.subtitle")}
            headerLeading={
                <GlassButton
                    as="button"
                    aria-label={t("merchant.create.actions.back")}
                    icon={<ArrowLeftIcon width={22} height={22} />}
                    onClick={() => setStep(1)}
                />
            }
            footer={
                <Button
                    type="button"
                    variant="primary"
                    size="large"
                    loading={isRegistering}
                    disabled={isRegistering}
                    icon={<FaceIdIcon width={16} height={16} />}
                    onClick={onRegister}
                >
                    {t("merchant.create.actions.completeRegistration")}
                </Button>
            }
        >
            <MerchantRegistrationStep
                values={form.getValues()}
                error={error}
                infoTxt={infoTxt}
            />
        </WizardLayout>
    );
}
