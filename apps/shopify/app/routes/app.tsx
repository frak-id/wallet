import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppError } from "app/components/AppError";
import { Skeleton } from "app/components/Skeleton";
import type { loader as rootLoader } from "app/root";
import { frakEnv } from "app/services.server/frakEnv";
import { log } from "app/services.server/logger";
import {
    ensureComponentsUrlMetafield,
    ensureEnvMetafields,
    ensureKlaviyoShareMetafields,
    resolveMerchantId,
} from "app/services.server/merchant";
import { ensureFrakI18nMetaobject } from "app/services.server/metafields";
import { shopInfo } from "app/services.server/shop";
import {
    doesThemeSupportAppEmbed,
    doesThemeSupportBlock,
} from "app/services.server/theme";
import { shouldShowOutletSkeleton } from "app/utils/navigationLoading";
import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { fetchAllOnboardingData } from "app/utils/onboarding.server";
import { type ReactNode, Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
    Await,
    isRouteErrorResponse,
    Link,
    Outlet,
    useLoaderData,
    useLocation,
    useNavigation,
    useRouteError,
    useRouteLoaderData,
} from "react-router";
import { useRequestId } from "../providers/RequestId";
import { RootProvider } from "../providers/RootProvider";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const [shop, merchantId] = await Promise.all([
        shopInfo(context),
        resolveMerchantId(context),
    ]);

    // Fire-and-forget metafield syncs. Each helper already logs its own
    // handled failures; the outer `.catch` only guards an unexpected reject
    // (e.g. the pre-try `shopInfo` lookup). Log it rather than swallowing it
    // silently — an empty `.catch(() => {})` is a latent trap that hides a
    // regression exactly when these start failing.
    ensureEnvMetafields(context).catch((err) =>
        log.warn({ err }, "ensureEnvMetafields failed")
    );
    ensureComponentsUrlMetafield(context).catch((err) =>
        log.warn({ err }, "ensureComponentsUrlMetafield failed")
    );
    ensureKlaviyoShareMetafields(context).catch((err) =>
        log.warn({ err }, "ensureKlaviyoShareMetafields failed")
    );
    ensureFrakI18nMetaobject(context).catch((err) =>
        log.warn({ err }, "ensureFrakI18nMetaobject failed")
    );

    return {
        apiKey: process.env.SHOPIFY_API_KEY || "",
        businessUrl: process.env.BUSINESS_URL || "https://business.frak.id",
        env: frakEnv(),
        componentsUrl:
            process.env.FRAK_COMPONENTS_URL ||
            "https://cdn.jsdelivr.net/npm/@frak-labs/components@latest",
        shopifyLogoUrl: `${process.env.SHOPIFY_APP_URL ?? ""}/shopify-logo.svg`,
        // Defensive: a custom/unsupported theme should degrade to
        // "not supported", never reject the streamed promise and crash the
        // whole admin route.
        isThemeSupportedPromise: doesThemeSupportBlock(context).catch(
            () => false
        ),
        // App embed support (Frak Listener). True on OS 2.0 AND vintage themes
        // like Debut; only genuinely broken/ancient themes are false. Drives
        // whether Listener activation (onboarding step 5) is critical.
        supportsAppEmbedPromise: doesThemeSupportAppEmbed(context).catch(
            // Fail open: app embeds are near-universal, so never hide the
            // Listener step on a detection hiccup.
            () => true
        ),
        shop,
        merchantId,
        onboardingDataPromise: fetchAllOnboardingData(context, request),
    };
};

export default function App() {
    const {
        apiKey,
        isThemeSupportedPromise,
        supportsAppEmbedPromise,
        onboardingDataPromise,
    } = useLoaderData<typeof loader>();
    return (
        <AppProvider embedded apiKey={apiKey}>
            <RootProvider>
                <Suspense fallback={<Skeleton />}>
                    <AppContent
                        isThemeSupportedPromise={isThemeSupportedPromise}
                        supportsAppEmbedPromise={supportsAppEmbedPromise}
                        onboardingDataPromise={onboardingDataPromise}
                    />
                </Suspense>
            </RootProvider>
        </AppProvider>
    );
}

function AppContent({
    isThemeSupportedPromise,
    supportsAppEmbedPromise,
    onboardingDataPromise,
}: {
    isThemeSupportedPromise: Promise<boolean>;
    supportsAppEmbedPromise: Promise<boolean>;
    onboardingDataPromise: Promise<OnboardingStepData>;
}) {
    const navigation = useNavigation();
    const location = useLocation();
    const isLoading = shouldShowOutletSkeleton({
        currentPathname: location.pathname,
        navigationState: navigation.state,
        nextPathname: navigation.location?.pathname ?? null,
    });

    return (
        <Await resolve={isThemeSupportedPromise}>
            {(isThemeSupported) => (
                <Await resolve={supportsAppEmbedPromise} errorElement={null}>
                    {(supportsAppEmbed) => (
                        <>
                            <Navigation
                                isThemeSupported={isThemeSupported}
                                supportsAppEmbed={supportsAppEmbed ?? true}
                                onboardingDataPromise={onboardingDataPromise}
                            />
                            {isLoading ? <Skeleton /> : <Outlet />}
                        </>
                    )}
                </Await>
            )}
        </Await>
    );
}

// Shopify needs React Router to catch some thrown responses (auth
// re-authorization redirects, etc.) so that their headers are included in the
// response — those MUST keep going through `boundary.error`. Any other runtime
// error is rendered as a friendly fallback instead of the bare red
// "Application Error" page.
export function ErrorBoundary() {
    const error = useRouteError();
    // Hooks must run unconditionally, before the isRouteErrorResponse return.
    // Fall back to the request-scoped id (context) if root's loader data is
    // unavailable, so the support reference never silently vanishes.
    const loaderRequestId =
        useRouteLoaderData<typeof rootLoader>("root")?.requestId;
    const contextRequestId = useRequestId();
    const requestId = loaderRequestId ?? contextRequestId;
    if (isRouteErrorResponse(error)) {
        return boundary.error(error);
    }
    return <AppError error={error} requestId={requestId} />;
}

export const headers: HeadersFunction = (headersArgs) => {
    return boundary.headers(headersArgs);
};

/**
 * Show the navigation menu only if the theme supports the block and onboarding
 * critical steps are complete. Wallet connection is no longer required here —
 * it is requested at the point of need (product registration, bank actions).
 * @param isThemeSupported
 */
function Navigation({
    isThemeSupported,
    supportsAppEmbed,
    onboardingDataPromise,
}: {
    isThemeSupported: boolean;
    supportsAppEmbed: boolean;
    onboardingDataPromise: Promise<OnboardingStepData>;
}) {
    return (
        <NavigationRoot>
            {/* Legacy merchants also get nav — gated only on onboarding steps
                1-4; the theme-activation step is non-critical for them. */}
            <Suspense>
                <Await resolve={onboardingDataPromise} errorElement={null}>
                    {(onboardingData) => {
                        const validationResult = validateCompleteOnboarding(
                            onboardingData,
                            isThemeSupported,
                            supportsAppEmbed
                        );
                        if (validationResult.hasMissedCriticalSteps)
                            return null;
                        return <NavigationContent />;
                    }}
                </Await>
            </Suspense>
        </NavigationRoot>
    );
}

function NavigationRoot({ children }: { children: ReactNode }) {
    return (
        <ui-nav-menu>
            <Link to="/app" rel="home">
                Home
            </Link>
            {children}
        </ui-nav-menu>
    );
}

function NavigationContent() {
    const { t } = useTranslation();

    return (
        <>
            <Link to="/app/campaigns">{t("navigation.campaigns")}</Link>
            <Link to="/app/appearance">{t("navigation.appearance")}</Link>
            <Link to="/app/funding">{t("navigation.funding")}</Link>
            <Link to="/app/settings">{t("navigation.settings.title")}</Link>
        </>
    );
}
