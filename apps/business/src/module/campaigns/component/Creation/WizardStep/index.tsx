import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import type { StepperStep } from "@frak-labs/design-system/components/Stepper";
import { Text } from "@frak-labs/design-system/components/Text";
import { ArrowLeftIcon, CheckIcon } from "@frak-labs/design-system/icons";
import { useNavigate, useParams } from "@tanstack/react-router";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/module/common/component/Button";
import { WizardLayout } from "@/module/common/component/WizardLayout";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { campaignStore, isPurchaseCampaign } from "@/stores/campaignStore";
import { InfoBanner } from "../InfoBanner";
import { ButtonCancel } from "../NewCampaign/ButtonCancel";
import {
    isLastStep,
    previousStep,
    stepI18n,
    stepIndexOf,
    type WizardStepKey,
    wizardStepsFor,
} from "../wizardSteps";

type WizardStepProps = {
    /** Which wizard step this page represents. */
    stepKey: WizardStepKey;
    /** id of the `<form>` the sticky Continue/Publish button submits. */
    formId: string;
    /** Continue is enabled only when the step's form is valid. */
    isValid?: boolean;
    /** Disable actions + spin Continue while the step is saving. */
    isPending?: boolean;
    /** Show a "draft saved" notice: the last save succeeded and nothing changed since. */
    isSaved?: boolean;
    /** Show a notice that the last save failed. */
    saveFailed?: boolean;
    /**
     * One short sentence shown next to the button while Continue is disabled,
     * so the user knows what is missing. Ignored when the step is valid.
     */
    disabledReason?: string;
    /** Save-as-draft handler (header pill). */
    onSaveDraft?: () => void;
    /** Reset/cleanup before the cancel confirmation navigates away. */
    onClose?: () => void;
    /**
     * Whether the step has unsaved edits. When `false` (e.g. right after
     * "Save as draft"), the close "X" skips the confirmation and leaves.
     */
    hasUnsavedChanges?: boolean;
    children: ReactNode;
};

export function WizardStep({
    stepKey,
    formId,
    isValid = true,
    isPending = false,
    isSaved = false,
    saveFailed = false,
    disabledReason,
    onSaveDraft,
    onClose,
    hasUnsavedChanges = true,
    children,
}: WizardStepProps) {
    const { t } = useTranslation();
    const reasonId = useId();
    const navigate = useNavigate();
    const merchantId = useActiveMerchantId();
    const { campaignId } = useParams({ strict: false }) as {
        campaignId?: string;
    };

    // A non-purchase campaign has no product-scope step. The step itself is
    // still reachable by URL, so keep it in the rail when it's the one being
    // rendered rather than leave the wizard without a current step.
    const isPurchase = campaignStore((s) => isPurchaseCampaign(s.draft.rule));
    const wizardSteps = wizardStepsFor(isPurchase || stepKey === "products");

    const activeStep = stepIndexOf(stepKey, wizardSteps);
    const previous = previousStep(activeStep, wizardSteps);
    const lastStep = isLastStep(activeStep, wizardSteps);

    // Resolve the rail labels/hints from i18n.
    const steps: StepperStep[] = wizardSteps.map((s) => {
        const keys = stepI18n(s.key);
        return { title: t(keys.label), description: t(keys.hint) };
    });

    const current = stepI18n(stepKey);
    const reason = !isValid && !isPending ? disabledReason : undefined;

    return (
        <WizardLayout
            steps={steps}
            activeStep={activeStep}
            title={t(current.label)}
            description={t(current.subtitle)}
            headerLeading={
                previous && (
                    <GlassButton
                        as="button"
                        aria-label={t("campaigns.create.actions.back")}
                        title={t("campaigns.create.actions.back")}
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
                        size="small"
                        onClick={onSaveDraft}
                        disabled={isPending}
                        loading={isPending}
                    >
                        {t("campaigns.create.actions.saveDraft")}
                    </Button>
                    <ButtonCancel
                        onClick={() => onClose?.()}
                        hasUnsavedChanges={hasUnsavedChanges}
                    />
                </>
            }
            footer={
                <>
                    {reason && (
                        <Text
                            id={reasonId}
                            variant="bodySmall"
                            color="secondary"
                        >
                            {reason}
                        </Text>
                    )}
                    <Button
                        type="submit"
                        form={formId}
                        variant="primary"
                        size="large"
                        loading={isPending}
                        disabled={!isValid || isPending}
                        aria-describedby={reason ? reasonId : undefined}
                        data-tour={lastStep ? "campaign-publish" : undefined}
                        rightIcon={
                            lastStep ? (
                                <CheckIcon width={16} height={16} />
                            ) : undefined
                        }
                    >
                        {lastStep
                            ? t("campaigns.create.actions.publish")
                            : t("campaigns.create.actions.continue")}
                    </Button>
                </>
            }
        >
            <Stack space="m">
                {saveFailed && (
                    <InfoBanner tone="error">
                        {t("campaigns.create.actions.saveError")}
                    </InfoBanner>
                )}
                {isSaved && !saveFailed && (
                    <InfoBanner>
                        {t("campaigns.create.actions.draftSaved")}
                    </InfoBanner>
                )}
                {children}
            </Stack>
        </WizardLayout>
    );
}
