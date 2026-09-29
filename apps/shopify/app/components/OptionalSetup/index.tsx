import { usePageScopes } from "app/hooks/usePageScopes";
import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type { loader as appLoader } from "app/routes/app";
import type { action as ambassadorPageAction } from "app/routes/app.ambassador-page";
import type { AmbassadorCardState } from "app/services.server/ambassadorPage";
import type { OnboardingStepData } from "app/utils/onboarding";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher, useRouteLoaderData } from "react-router";
import screenShareButton from "../../assets/share-button.png";
import { useRefreshData } from "../../hooks/useRefreshData";
import { ExternalButton } from "../ui/ExternalLink";

const AMBASSADOR_FETCHER_KEY = "ambassador-page";

/**
 * "Finish your setup" cards for the optional storefront blocks: share button,
 * banner and ambassador page. Each card hides once its block is detected; the
 * ambassador card stays while it shows the confirmation of a page just made.
 * Tab visibility triggers a refresh so theme-editor changes show up.
 */
export function OptionalSetup({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { t } = useTranslation();
    const refresh = useRefreshData();
    const ambassadorFetcher = useFetcher<typeof ambassadorPageAction>({
        key: AMBASSADOR_FETCHER_KEY,
    });

    useVisibilityChange(
        useCallback(() => {
            refresh();
        }, [refresh])
    );

    const showShareButton =
        !onboardingData.isThemeHasFrakButton &&
        Boolean(onboardingData.firstProduct);
    const showBanner = !onboardingData.isThemeHasFrakBanner;
    const ambassadorState = onboardingData.ambassadorPage?.state ?? "none";
    const ambassadorData = ambassadorFetcher.data;
    const createdPageUrl =
        ambassadorState === "linked" && ambassadorData?.ok
            ? ambassadorData.url
            : null;
    const showAmbassador =
        ambassadorState !== "linked" || createdPageUrl !== null;

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
                            createdPageUrl={createdPageUrl}
                        />
                    )}
                </s-stack>
            </s-stack>
        </s-section>
    );
}

function useAdminUrl(): string {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    return `https://${rootData?.shop?.myshopifyDomain}/admin`;
}

function useThemeEditorUrl(): string {
    return `${useAdminUrl()}/themes/current/editor`;
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

type AmbassadorCardProps = {
    state: AmbassadorCardState["state"];
    createdPageUrl: string | null;
};

function AmbassadorCard({ state, createdPageUrl }: AmbassadorCardProps) {
    const { t, i18n } = useTranslation();
    const { requestPageScopes } = usePageScopes();
    const fetcher = useFetcher<typeof ambassadorPageAction>({
        key: AMBASSADOR_FETCHER_KEY,
    });
    const pendingRef = useRef(false);
    const [pending, setPending] = useState(false);
    const isBusy = pending || fetcher.state !== "idle";
    const failure = fetcher.data?.ok === false ? fetcher.data.reason : null;

    // `fetcher.data` re-runs the toast when the same failure repeats.
    useEffect(() => {
        if (failure === "createFailed" || failure === "linkFailed") {
            shopify.toast.show(t(`optionalSetup.ambassador.${failure}`), {
                isError: true,
            });
        }
    }, [failure, fetcher.data, t]);

    const handleClick = async (intent: "create" | "link") => {
        // The ref blocks a same-tick second click; state only re-renders.
        if (pendingRef.current) return;
        pendingRef.current = true;
        setPending(true);
        try {
            if (!(await requestPageScopes())) {
                shopify.toast.show(t("optionalSetup.ambassador.declined"), {
                    isError: true,
                });
                return;
            }
            fetcher.submit(
                { intent, language: i18n.language },
                { method: "POST", action: "/app/ambassador-page" }
            );
        } finally {
            pendingRef.current = false;
            setPending(false);
        }
    };

    return (
        <s-box background="subdued" padding="base">
            <s-stack gap="base">
                <s-heading>{t("optionalSetup.ambassador.title")}</s-heading>
                {createdPageUrl ? (
                    <>
                        <s-text>{t("optionalSetup.ambassador.created")}</s-text>
                        <ExternalButton variant="primary" href={createdPageUrl}>
                            {t("optionalSetup.ambassador.viewPage")}
                        </ExternalButton>
                    </>
                ) : state === "blockUnlinked" ? (
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
                            loading={isBusy}
                            disabled={isBusy}
                            onClick={() => handleClick("link")}
                        >
                            {t("optionalSetup.ambassador.linkCta")}
                        </s-button>
                        <s-text>
                            {t("optionalSetup.ambassador.createInstead")}
                        </s-text>
                        <s-button
                            variant="secondary"
                            loading={isBusy}
                            disabled={isBusy}
                            onClick={() => handleClick("create")}
                        >
                            {t("optionalSetup.ambassador.createCta")}
                        </s-button>
                    </>
                ) : (
                    <>
                        <s-text>
                            {t("optionalSetup.ambassador.description")}
                        </s-text>
                        <s-text>
                            {t("optionalSetup.ambassador.createDescription")}
                        </s-text>
                        <s-button
                            variant="primary"
                            loading={isBusy}
                            disabled={isBusy}
                            onClick={() => handleClick("create")}
                        >
                            {t("optionalSetup.ambassador.createCta")}
                        </s-button>
                        <ManualAmbassadorSteps />
                    </>
                )}
            </s-stack>
        </s-box>
    );
}

function ManualAmbassadorSteps() {
    const { t } = useTranslation();
    const adminUrl = useAdminUrl();
    const editorUrl = useThemeEditorUrl();

    // No `addAppBlockId` deep link: it could only target the default page
    // template, which would put the ambassador page on every page.
    return (
        <>
            <s-text>{t("optionalSetup.ambassador.manualIntro")}</s-text>
            <s-text>{t("optionalSetup.ambassador.step1")}</s-text>
            <ExternalButton variant="secondary" href={`${adminUrl}/pages/new`}>
                {t("optionalSetup.ambassador.step1Cta")}
            </ExternalButton>
            <s-text>{t("optionalSetup.ambassador.step2")}</s-text>
            <ExternalButton
                variant="secondary"
                href={`${editorUrl}?template=page`}
            >
                {t("optionalSetup.ambassador.step2Cta")}
            </ExternalButton>
            <s-text>{t("optionalSetup.ambassador.step3")}</s-text>
        </>
    );
}
