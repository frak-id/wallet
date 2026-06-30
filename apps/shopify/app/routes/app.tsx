import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppError } from "app/components/AppError";
import { Skeleton } from "app/components/Skeleton";
import type { loader as rootLoader } from "app/root";
import {
    ensureComponentsUrlMetafield,
    ensureKlaviyoShareMetafields,
    ensureWalletUrlMetafield,
    resolveMerchantId,
} from "app/services.server/merchant";
import { ensureFrakI18nMetaobject } from "app/services.server/metafields";
import { shopInfo } from "app/services.server/shop";
import { doesThemeSupportBlock } from "app/services.server/theme";
import { shouldShowOutletSkeleton } from "app/utils/navigationLoading";
import {
    fetchAllOnboardingData,
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
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
import { RootProvider } from "../providers/RootProvider";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const [shop, merchantId] = await Promise.all([
        shopInfo(context),
        resolveMerchantId(context),
    ]);

    // Fire-and-forget: sync wallet URL metafield for listener.liquid
    ensureWalletUrlMetafield(context).catch(() => {});
    // Fire-and-forget: sync components CDN URL metafield for listener.liquid
    ensureComponentsUrlMetafield(context).catch(() => {});
    // Fire-and-forget: sync Klaviyo share metafields so merchants can paste
    // a ready-to-use share CTA into their email templates without
    // hard-coding the storefront host.
    ensureKlaviyoShareMetafields(context).catch(() => {});
    // Fire-and-forget: ensure the frak_i18n metaobject singleton entry
    // exists with EN seeds + bundled FR translations.
    ensureFrakI18nMetaobject(context).catch(() => {});

    return {
        apiKey: process.env.SHOPIFY_API_KEY || "",
        businessUrl: process.env.BUSINESS_URL || "https://business.frak.id",
        walletUrl: process.env.FRAK_WALLET_URL || "https://wallet.frak.id",
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
        shop,
        merchantId,
        onboardingDataPromise: fetchAllOnboardingData(context, request),
    };
};

export default function App() {
    const { apiKey, isThemeSupportedPromise, onboardingDataPromise } =
        useLoaderData<typeof loader>();
    return (
        <AppProvider embedded apiKey={apiKey}>
            <RootProvider>
                <Suspense fallback={<Skeleton />}>
                    <AppContent
                        isThemeSupportedPromise={isThemeSupportedPromise}
                        onboardingDataPromise={onboardingDataPromise}
                    />
                </Suspense>
            </RootProvider>
        </AppProvider>
    );
}

function AppContent({
    isThemeSupportedPromise,
    onboardingDataPromise,
}: {
    isThemeSupportedPromise: Promise<boolean>;
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
            {(isThemeSupported) => {
                return (
                    <>
                        <Navigation
                            isThemeSupported={isThemeSupported}
                            onboardingDataPromise={onboardingDataPromise}
                        />
                        {isLoading ? <Skeleton /> : <Outlet />}
                    </>
                );
            }}
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
    const requestId = useRouteLoaderData<typeof rootLoader>("root")?.requestId;
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
    onboardingDataPromise,
}: {
    isThemeSupported: boolean;
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
                            isThemeSupported
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
