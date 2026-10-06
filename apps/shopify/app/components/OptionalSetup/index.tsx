import { useThemeEditorUrl } from "app/hooks/useThemeEditorUrl";
import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type { AmbassadorPageStatus } from "app/utils/ambassadorPage";
import type { OnboardingStepData } from "app/utils/onboarding";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import screenShareButton from "../../assets/share-button.png";
import { useRefreshData } from "../../hooks/useRefreshData";
import { ExternalButton } from "../ui/ExternalLink";

/**
 * "Finish your setup" cards: share button and banner (themes with app blocks
 * only) and the ambassador page (every theme). Each card hides once its part
 * is set up. Tab visibility triggers a refresh so theme-editor changes show up.
 */
export function OptionalSetup({
    onboardingData,
    isThemeSupported,
}: {
    onboardingData: OnboardingStepData;
    isThemeSupported: boolean;
}) {
    const { t } = useTranslation();
    const refresh = useRefreshData();

    useVisibilityChange(refresh);

    const showShareButton =
        isThemeSupported &&
        !onboardingData.isThemeHasFrakButton &&
        Boolean(onboardingData.firstProduct);
    const showBanner = isThemeSupported && !onboardingData.isThemeHasFrakBanner;
    const ambassadorStatus = onboardingData.ambassadorPage;
    const showAmbassador =
        ambassadorStatus === "draft" || ambassadorStatus === "oldPage";

    if (!showShareButton && !showBanner && !showAmbassador) return null;

    return (
        <s-section accessibilityLabel={t("optionalSetup.title")}>
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
                    {showAmbassador && (
                        <AmbassadorCard status={ambassadorStatus} />
                    )}
                </s-stack>
            </s-stack>
        </s-section>
    );
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

function AmbassadorCard({
    status,
}: {
    status: Extract<AmbassadorPageStatus, "draft" | "oldPage">;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const isOldPage = status === "oldPage";

    return (
        <s-box background="subdued" padding="base">
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.ambassador.title")}</s-heading>
                <s-text>
                    {t(
                        isOldPage
                            ? "optionalSetup.ambassador.oldPageDescription"
                            : "optionalSetup.ambassador.description"
                    )}
                </s-text>
                <s-stack direction="inline">
                    <s-button
                        variant="secondary"
                        onClick={() => navigate("/app/ambassador")}
                    >
                        {t(
                            isOldPage
                                ? "optionalSetup.ambassador.oldPageCta"
                                : "optionalSetup.ambassador.cta"
                        )}
                    </s-button>
                </s-stack>
            </s-stack>
        </s-box>
    );
}
