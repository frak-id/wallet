import { useAmbassadorPageAction } from "app/hooks/useAmbassadorPageAction";
import { useThemeEditorUrl } from "app/hooks/useThemeEditorUrl";
import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type { AmbassadorCardState } from "app/services.server/ambassadorPage";
import type { OnboardingStepData } from "app/utils/onboarding";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import screenShareButton from "../../assets/share-button.png";
import { useRefreshData } from "../../hooks/useRefreshData";
import { ExternalButton } from "../ui/ExternalLink";

/**
 * "Finish your setup" cards for the optional storefront blocks: share button,
 * banner and ambassador page. Each card hides once its block is detected; the
 * ambassador card stays while it shows the confirmation of an action just run.
 * Tab visibility triggers a refresh so theme-editor changes show up.
 */
export function OptionalSetup({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { t } = useTranslation();
    const refresh = useRefreshData();
    const ambassador = useAmbassadorPageAction();
    const { clearLive } = ambassador;

    useVisibilityChange(
        useCallback(() => {
            clearLive();
            refresh();
        }, [clearLive, refresh])
    );

    const showShareButton =
        !onboardingData.isThemeHasFrakButton &&
        Boolean(onboardingData.firstProduct);
    const showBanner = !onboardingData.isThemeHasFrakBanner;
    const ambassadorState: AmbassadorCardState =
        onboardingData.ambassadorPage ?? {
            state: "none",
        };
    const showAmbassador =
        ambassador.liveUrl !== null ||
        !(
            ambassadorState.state === "linked" ||
            (ambassadorState.state === "upgrade" &&
                ambassadorState.standardLayoutKept)
        );

    if (!showShareButton && !showBanner && !showAmbassador) return null;

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
                    {showAmbassador && (
                        <AmbassadorCard
                            state={ambassadorState}
                            action={ambassador}
                        />
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

export const AMBASSADOR_GUIDE_HREF = "/app/ambassador-guide";

export type AmbassadorAction = ReturnType<typeof useAmbassadorPageAction>;

function AmbassadorCard({
    state,
    action,
}: {
    state: AmbassadorCardState;
    action: AmbassadorAction;
}) {
    const { t } = useTranslation();

    return (
        <s-box background="subdued" padding="base">
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.ambassador.title")}</s-heading>
                {action.liveUrl && (
                    <AmbassadorLive
                        url={action.liveUrl}
                        message={action.liveMessage}
                    />
                )}
                <AmbassadorOffer state={state} action={action} />
            </s-stack>
        </s-box>
    );
}

function AmbassadorOffer({
    state,
    action,
}: {
    state: AmbassadorCardState;
    action: AmbassadorAction;
}) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const openGuide = () => navigate(AMBASSADOR_GUIDE_HREF);
    const { run, isBusy, failure } = action;
    const busy = { loading: isBusy, disabled: isBusy };

    switch (state.state) {
        case "linked":
            return null;
        case "blockUnlinked":
            return (
                <>
                    <s-text>
                        {t("optionalSetup.ambassador.linkDescription")}
                    </s-text>
                    {failure === "noPublishedPage" && (
                        <s-text>
                            {t("optionalSetup.ambassador.noPublishedPage")}
                        </s-text>
                    )}
                    <s-button
                        variant="primary"
                        {...busy}
                        onClick={() => run("link")}
                    >
                        {t("optionalSetup.ambassador.linkCta")}
                    </s-button>
                    <s-text>
                        {t("optionalSetup.ambassador.createInstead")}
                    </s-text>
                    <s-button
                        variant="secondary"
                        {...busy}
                        onClick={() => run("create")}
                    >
                        {t("optionalSetup.ambassador.createCta")}
                    </s-button>
                </>
            );
        case "none":
            return (
                <>
                    <s-text>{t("optionalSetup.ambassador.description")}</s-text>
                    <s-text>
                        {t("optionalSetup.ambassador.createDescription")}
                    </s-text>
                    <s-button
                        variant="primary"
                        {...busy}
                        onClick={() => run("create")}
                    >
                        {t("optionalSetup.ambassador.createCta")}
                    </s-button>
                    <s-text>{t("optionalSetup.ambassador.guideIntro")}</s-text>
                    <s-button variant="secondary" onClick={openGuide}>
                        {t("optionalSetup.ambassador.guideCta")}
                    </s-button>
                </>
            );
        case "upgrade":
            if (state.standardLayoutKept) return null;
            return (
                <>
                    <s-text>
                        {t(
                            state.onTemplate
                                ? "optionalSetup.ambassador.duplicateDescription"
                                : "optionalSetup.ambassador.upgradeDescription"
                        )}
                    </s-text>
                    {state.template ? (
                        <ApplyButton
                            template={state.template}
                            action={action}
                        />
                    ) : (
                        <s-button variant="primary" onClick={openGuide}>
                            {t("optionalSetup.ambassador.fullWidthCta")}
                        </s-button>
                    )}
                    {!state.onTemplate && (
                        <s-button
                            variant="secondary"
                            {...busy}
                            onClick={() => run("keepStandard")}
                        >
                            {t("optionalSetup.ambassador.keepStandardCta")}
                        </s-button>
                    )}
                </>
            );
        case "blank":
            return (
                <>
                    <s-text>
                        {t("optionalSetup.ambassador.blankDescription")}
                    </s-text>
                    {state.template && (
                        <ApplyButton
                            template={state.template}
                            action={action}
                        />
                    )}
                    <s-text>
                        {t("optionalSetup.ambassador.restoreDescription")}
                    </s-text>
                    <s-button
                        variant={state.template ? "secondary" : "primary"}
                        {...busy}
                        onClick={() => run("restore")}
                    >
                        {t("optionalSetup.ambassador.restoreCta")}
                    </s-button>
                </>
            );
    }
}

export function AmbassadorLive({
    url,
    message,
}: {
    url: string;
    message: string;
}) {
    const { t } = useTranslation();

    return (
        <>
            <s-text>{message}</s-text>
            <ExternalButton variant="primary" href={url}>
                {t("optionalSetup.ambassador.viewPage")}
            </ExternalButton>
        </>
    );
}

export function ApplyButton({
    template,
    action,
}: {
    template: string;
    action: AmbassadorAction;
}) {
    const { t } = useTranslation();

    return (
        <s-button
            variant="primary"
            loading={action.isBusy}
            disabled={action.isBusy}
            onClick={() => action.run("apply", template)}
        >
            {t("optionalSetup.ambassador.applyCta", { template })}
        </s-button>
    );
}
