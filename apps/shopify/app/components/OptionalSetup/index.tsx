import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type { loader as appLoader } from "app/routes/app";
import type { OnboardingStepData } from "app/utils/onboarding";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useRouteLoaderData } from "react-router";
import screenShareButton from "../../assets/share-button.png";
import { useRefreshData } from "../../hooks/useRefreshData";
import { ExternalButton } from "../ui/ExternalLink";

/**
 * Surfaces the two non-critical onboarding items (share button + banner)
 * as a "finish your setup" card on the index page.
 *
 * Renders once the critical onboarding (steps 1-5) is done — the
 * merchant can already ship live, but these UI bits unlock storefront
 * discovery (share button) and referee conversion (banner). The card
 * disappears entirely once both are activated.
 *
 * Tab visibility triggers a refresh so detection picks up changes made
 * in the Shopify theme editor without a manual reload.
 */
export function OptionalSetup({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { t } = useTranslation();
    const refresh = useRefreshData();

    useVisibilityChange(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    const showShareButton =
        !onboardingData.isThemeHasFrakButton &&
        Boolean(onboardingData.firstProduct);
    const showBanner = !onboardingData.isThemeHasFrakBanner;

    if (!showShareButton && !showBanner) return null;

    return (
        <s-section>
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.title")}</s-heading>
                <s-text>{t("optionalSetup.description")}</s-text>
                <s-stack gap="base">
                    {showShareButton && (
                        <ShareButtonCard
                            productHandle={onboardingData.firstProduct?.handle}
                        />
                    )}
                    {showBanner && <BannerCard />}
                </s-stack>
            </s-stack>
        </s-section>
    );
}

function useThemeEditorUrl(): string {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    return `https://${rootData?.shop?.myshopifyDomain}/admin/themes/current/editor`;
}

function ShareButtonCard({ productHandle }: { productHandle?: string }) {
    const { t } = useTranslation();
    const editorUrl = useThemeEditorUrl();
    const href = productHandle
        ? `${editorUrl}?previewPath=/products/${productHandle}`
        : null;

    return (
        <s-box background="subdued" padding="base">
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.shareButton.title")}</s-heading>
                <s-text>{t("optionalSetup.shareButton.description")}</s-text>
                <img
                    src={screenShareButton}
                    alt=""
                    style={{ maxWidth: "320px" }}
                />
                {href && (
                    <ExternalButton variant="primary" href={href}>
                        {t("optionalSetup.shareButton.cta")}
                    </ExternalButton>
                )}
            </s-stack>
        </s-box>
    );
}

function BannerCard() {
    const { t } = useTranslation();
    const editorUrl = useThemeEditorUrl();

    return (
        <s-box background="subdued" padding="base">
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.banner.title")}</s-heading>
                <s-text>{t("optionalSetup.banner.description")}</s-text>
                <ExternalButton
                    variant="primary"
                    href={`${editorUrl}?context=apps`}
                >
                    {t("optionalSetup.banner.cta")}
                </ExternalButton>
            </s-stack>
        </s-box>
    );
}
