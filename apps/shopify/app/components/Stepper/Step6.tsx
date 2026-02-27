import type { loader as rootLoader } from "app/routes/app";
import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { Trans, useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import screenShareButton from "../../assets/share-button.png";
import screenWalletButton from "../../assets/wallet-button.png";
import { ExternalButton } from "../ui/ExternalLink";
import { CollapsibleStep } from "./CollapsibleStep";

export function Step6({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { isThemeHasFrakButton, themeWalletButton, firstProduct } =
        onboardingData;
    const { t } = useTranslation();
    const rootData = useRouteLoaderData<typeof rootLoader>("routes/app");
    const editorUrl = `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;
    const isThemeWalletButtonExist = !!themeWalletButton;
    const isCompleted = !!(isThemeHasFrakButton || themeWalletButton);
    const { failedSteps } = validateCompleteOnboarding(onboardingData);

    return (
        <CollapsibleStep
            step={6}
            currentStep={failedSteps[0]}
            completed={isCompleted}
            title={t("stepper.step6.title")}
        >
            <s-grid gridTemplateColumns="1fr 1fr" gap="base">
                {!isThemeHasFrakButton && firstProduct && (
                    <div>
                        <s-stack gap="base">
                            <s-text>
                                <Trans i18nKey="stepper.step6.descriptionShare" />
                            </s-text>
                            <img src={screenShareButton} alt="" />
                            <ExternalButton
                                variant="primary"
                                href={`${editorUrl}?previewPath=/products/${firstProduct.handle}`}
                            >
                                {t("stepper.step6.linkShare")}
                            </ExternalButton>
                        </s-stack>
                    </div>
                )}
                {!isThemeWalletButtonExist && (
                    <div>
                        <s-stack gap="base">
                            <s-text>
                                <Trans i18nKey="stepper.step6.descriptionWallet" />
                            </s-text>
                            <img src={screenWalletButton} alt="" />
                            <ExternalButton
                                variant="primary"
                                href={`${editorUrl}?context=apps`}
                            >
                                {t("stepper.step6.linkWallet")}
                            </ExternalButton>
                        </s-stack>
                    </div>
                )}
            </s-grid>
        </CollapsibleStep>
    );
}
