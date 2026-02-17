import { useWalletStatus } from "@frak-labs/react-sdk";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { Skeleton } from "app/components/Skeleton";
import { WalletGated } from "app/components/WalletGated";
import { resolveMerchantId } from "app/services.server/merchant";
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
    Link,
    Outlet,
    useLoaderData,
    useLocation,
    useNavigation,
    useRouteError,
} from "react-router";
import { RootProvider } from "../providers/RootProvider";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const [shop, merchantId] = await Promise.all([
        shopInfo(context),
        resolveMerchantId(context),
    ]);

    return {
        apiKey: process.env.SHOPIFY_API_KEY || "",
        isThemeSupportedPromise: doesThemeSupportBlock(context),
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
                        <WalletGated>
                            {isLoading ? <Skeleton /> : <Outlet />}
                        </WalletGated>
                    </>
                );
            }}
        </Await>
    );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
    return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
    return boundary.headers(headersArgs);
};

/**
 * Show the navigation menu only if theme supports the block and wallet is connected
 * @param isThemeSupported
 */
function Navigation({
    isThemeSupported,
    onboardingDataPromise,
}: {
    isThemeSupported: boolean;
    onboardingDataPromise: Promise<OnboardingStepData>;
}) {
    const { data: walletStatus } = useWalletStatus();

    return (
        <NavigationRoot>
            {isThemeSupported && walletStatus?.wallet && (
                <Suspense>
                    <Await resolve={onboardingDataPromise}>
                        {(onboardingData) => {
                            const validationResult =
                                validateCompleteOnboarding(onboardingData);
                            if (validationResult.hasMissedCriticalSteps)
                                return null;
                            return <NavigationContent />;
                        }}
                    </Await>
                </Suspense>
            )}
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
            <Link to="/app/settings/general">
                {t("navigation.settings.title")}
            </Link>
        </>
    );
}
