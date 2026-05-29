import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import type { StepperStep } from "@frak-labs/design-system/components/Stepper";
import { ArrowLeftIcon } from "@frak-labs/design-system/icons";
import { useNavigate, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { CampaignWizardLayout } from "../CampaignWizardLayout";
import { ButtonCancel } from "../NewCampaign/ButtonCancel";
import {
    isLastStep,
    previousStep,
    stepI18n,
    stepIndexOf,
    WIZARD_STEPS,
    type WizardStepKey,
} from "../wizardSteps";

type WizardStepProps = {
    /** Which of the 7 steps this page represents. */
    stepKey: WizardStepKey;
    /** id of the `<form>` the sticky Continue/Publish button submits. */
    formId: string;
    /** Continue is enabled only when the step's form is valid. */
    isValid?: boolean;
    /** Disable actions + spin Continue while the step is saving. */
    isPending?: boolean;
    /** Save-as-draft handler (header pill). */
    onSaveDraft?: () => void;
    /** Reset/cleanup before the cancel confirmation navigates away. */
    onClose?: () => void;
    children: ReactNode;
};

export function WizardStep({
    stepKey,
    formId,
    isValid = true,
    isPending = false,
    onSaveDraft,
    onClose,
    children,
}: WizardStepProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const { campaignId } = useParams({ strict: false }) as {
        campaignId?: string;
    };

    const activeStep = stepIndexOf(stepKey);
    const previous = previousStep(activeStep);
    const lastStep = isLastStep(activeStep);

    // Resolve the rail labels/hints from i18n.
    const steps: StepperStep[] = WIZARD_STEPS.map((s) => {
        const keys = stepI18n(s.key);
        return { title: t(keys.label), description: t(keys.hint) };
    });

    const current = stepI18n(stepKey);

    return (
        <CampaignWizardLayout
            steps={steps}
            activeStep={activeStep}
            title={t(current.label)}
            description={t(current.subtitle)}
            headerLeading={
                previous && (
                    <GlassButton
                        as="button"
                        aria-label={t("campaigns.create.actions.back")}
                        icon={<ArrowLeftIcon width={22} height={22} />}
                        onClick={() => {
                            const to = previous.to
                                .replace("$merchantId", merchantId)
                                .replace("$campaignId", campaignId ?? "");
                            // biome-ignore lint/suspicious/noExplicitAny: dynamic wizard route string
                            navigate({ to: to as any });
                        }}
                    />
                )
            }
            headerActions={
                <>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={onSaveDraft}
                        disabled={isPending}
                        loading={isPending}
                    >
                        {t("campaigns.create.actions.saveDraft")}
                    </Button>
                    <ButtonCancel onClick={() => onClose?.()} />
                </>
            }
            footer={
                <Button
                    type="submit"
                    form={formId}
                    variant="primary"
                    loading={isPending}
                    disabled={!isValid || isPending}
                >
                    {lastStep
                        ? t("campaigns.create.actions.publish")
                        : t("campaigns.create.actions.continue")}
                </Button>
            }
        >
            {children}
        </CampaignWizardLayout>
    );
}
