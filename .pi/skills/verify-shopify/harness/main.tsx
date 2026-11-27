// Mounts the real apps/shopify route modules in a memory router with typed mock loader data. Scenario = URL query.
import { LoginErrorType } from "@shopify/shopify-app-react-router/server";
import { AppError } from "app/components/AppError";
import { defaultNS, interpolation, resources } from "app/i18n/config";
import { RootProvider } from "app/providers/RootProvider";
import type * as App from "app/routes/app";
import * as AppIndex from "app/routes/app._index";
import * as Ambassador from "app/routes/app.ambassador";
import * as Appearance from "app/routes/app.appearance";
import * as Campaigns from "app/routes/app.campaigns";
import * as Funding from "app/routes/app.funding";
import * as Onboarding from "app/routes/app.onboarding";
import * as Settings from "app/routes/app.settings";
import { loginErrorMessage } from "app/routes/auth.login/error.server";
import * as Login from "app/routes/auth.login/route";
import * as Purchase from "app/routes/purchase";
import { POLARIS_URL } from "app/utils/polaris";
import i18next from "i18next";
import { type ComponentType, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import {
    createMemoryRouter,
    isRouteErrorResponse,
    Outlet,
    RouterProvider,
    type UNSAFE_DataWithResponseInit,
    useRouteError,
} from "react-router";

type LoaderData<L extends (...args: never[]) => unknown> =
    Awaited<ReturnType<L>> extends UNSAFE_DataWithResponseInit<infer D>
        ? D
        : Awaited<ReturnType<L>>;

const q = new URLSearchParams(window.location.search);
const lng = q.get("lng") ?? "en";
const MERCHANT_ID = "11111111-1111-1111-1111-111111111111";
const BANK = "0x5555555555555555555555555555555555555555";
const TX_HASH =
    "0x8f3c2b1a9e7d6c5b4a39281706f5e4d3c2b1a0f9e8d7c6b5a493827160f5e4d3";
const now = Date.now();
const iso = (days: number) => new Date(now - days * 86_400_000).toISOString();

const shop = {
    id: "gid://shopify/Shop/1",
    name: "Ma Boutique",
    url: "https://ma-boutique.fr",
    domain: "ma-boutique.fr",
    normalizedDomain: "ma-boutique.fr",
    myshopifyDomain: "ma-boutique.myshopify.com",
    primaryDomain: {
        id: "gid://shopify/Domain/1",
        host: "ma-boutique.fr",
        url: "https://ma-boutique.fr",
    },
    preferredCurrency: "eur",
} as const;

const webhooks = [
    {
        node: {
            id: "gid://shopify/WebhookSubscription/1",
            topic: "ORDERS_UPDATED",
            endpoint: {
                __typename: "WebhookHttpEndpoint",
                callbackUrl:
                    "https://backend.frak.id/ext/products/webhook/oracle/shopify",
            },
            uri: "https://backend.frak.id/ext/products/webhook/oracle/shopify",
            filter: "",
            createdAt: iso(30),
            format: "JSON" as const,
        },
    },
];

/** onboarding=N: steps before N are done, N is the next one. "done" (default): everything set up. */
function onboardingData() {
    const raw = q.get("onboarding") ?? "done";
    const next = raw === "done" ? 99 : Number(raw);
    const done = (step: number) => step < next;
    return {
        merchantId: done(1) ? MERCHANT_ID : null,
        webPixel: done(2)
            ? { id: "gid://shopify/WebPixel/1", settings: "{}" }
            : undefined,
        webhooks: done(3) ? webhooks : [],
        frakWebhook: { setup: done(4) },
        isThemeHasFrakActivated: done(5),
        isThemeHasFrakButton: done(6),
        isThemeHasFrakBanner: done(7),
        ambassadorPage: "live" as const,
        theme: { gid: "gid://shopify/OnlineStoreTheme/1", id: "1" },
        firstProduct: { handle: "t-shirt-bio" },
    };
}

function bankStatus() {
    const s = q.get("bank") ?? "open";
    if (s === "none") return null;
    if (s === "undeployed")
        return {
            deployed: false,
            bankAddress: null,
            ownerHasManagerRole: false,
            managerRole: "no_wallet",
            vatApplicable: true,
        } as const;
    return {
        deployed: true,
        bankAddress: BANK,
        ownerHasManagerRole: s !== "walletless",
        managerRole: s === "walletless" ? "no_wallet" : "granted",
        vatApplicable: true,
    } as const;
}

const stats = (campaignId: string, shares: number, purchases: number) => ({
    campaignId,
    tokenAddress: null,
    referredInteractions: shares * 3,
    purchaseInteractions: purchases,
    createReferralLinkInteractions: shares,
    totalRewards: purchases * 5,
    attributedRevenue: purchases * 62,
    avgBasketValue: 62,
    ambassador: Math.round(shares / 4),
    sharingRate: 0.31,
    ctr: 0.42,
    costPerPurchase: 5,
    costPerShare: 1.5,
});

const DISTRIBUTION = [
    "depleted",
    "distributing",
    "not_deployed",
    "paused",
    "warning",
] as const;
const distribution = q.get("distribution") ?? "distributing";

type CampaignList = NonNullable<
    LoaderData<typeof Campaigns.loader>["campaigns"]
>;

const campaignItems: CampaignList["campaigns"] = [
    {
        id: "camp_1",
        name: "Parrainage printemps",
        status: "active",
        rewards: [
            { recipient: "referrer", amountType: "fixed", amount: 5 },
            { recipient: "referee", amountType: "fixed", amount: 3 },
        ],
        budgetConfig: [
            { label: "global", durationInSeconds: null, amount: 2000 },
        ],
        budgetUsed: { global: { used: 640 } },
        expiresAt: null,
        publishedAt: iso(40),
        createdAt: iso(45),
        stats: stats("camp_1", 412, 128),
    },
    {
        id: "camp_2",
        name: "Offre fidélité",
        status: "paused",
        rewards: [
            { recipient: "referrer", amountType: "percentage", percent: 10 },
        ],
        budgetConfig: [
            { label: "weekly", durationInSeconds: 604800, amount: 300 },
        ],
        budgetUsed: { weekly: { used: 120, resetAt: iso(-3) } },
        expiresAt: iso(-60),
        publishedAt: iso(20),
        createdAt: iso(22),
        stats: stats("camp_2", 96, 14),
    },
    {
        id: "camp_3",
        name: "Brouillon soldes d'été",
        status: "draft",
        rewards: [],
        budgetConfig: null,
        budgetUsed: null,
        expiresAt: null,
        publishedAt: null,
        createdAt: iso(2),
        stats: null,
    },
];

const campaigns: CampaignList = {
    bankDistributionStatus:
        DISTRIBUTION.find((s) => s === distribution) ?? null,
    campaigns: campaignItems,
};

const AMBASSADOR_STATUSES = ["draft", "hidden", "live", "oldPage"] as const;

function purchases() {
    const base = {
        shopId: 1,
        shop: shop.myshopifyDomain,
        confirmationUrl: "https://admin.shopify.com/charges/1/confirm",
        currency: "eur",
        bank: BANK,
        updatedAt: new Date(now),
    } as const;
    return [
        {
            ...base,
            id: 3,
            purchaseId: 1003,
            amount: "500",
            status: "pending",
            txHash: null,
            txStatus: null,
            createdAt: new Date(now - 3_600_000),
        },
        {
            ...base,
            id: 2,
            purchaseId: 1002,
            amount: "250",
            status: "active",
            txHash: null,
            txStatus: "pending",
            createdAt: new Date(now - 86_400_000),
        },
        {
            ...base,
            id: 1,
            purchaseId: 1001,
            amount: "1000",
            status: "active",
            txHash: TX_HASH,
            txStatus: "confirmed",
            createdAt: new Date(now - 12 * 86_400_000),
        },
    ] satisfies LoaderData<typeof Funding.loader>["currentPurchases"];
}

const PURCHASE_STATES = {
    pending: { status: "pending", txStatus: null, txHash: null },
    processing: { status: "active", txStatus: "pending", txHash: null },
    confirmed: { status: "active", txStatus: "confirmed", txHash: TX_HASH },
    declined: { status: "declined", txStatus: null, txHash: null },
} as const;

function purchaseRow(): LoaderData<typeof Purchase.loader>["purchase"] {
    const state = q.get("state") ?? "confirmed";
    if (!(state in PURCHASE_STATES)) return null;
    return {
        ...purchases()[0],
        ...PURCHASE_STATES[state as keyof typeof PURCHASE_STATES],
        amount: "500",
    };
}

function ambassadorOverview(): LoaderData<
    typeof Ambassador.loader
>["overview"] {
    const raw = q.get("status") ?? "live";
    const status = AMBASSADOR_STATUSES.find((s) => s === raw);
    if (!status) return null;
    return {
        status,
        url: "https://ma-boutique.fr/apps/frak/ambassadeur",
        path: "/apps/frak/ambassadeur",
        oldPageUrl:
            status === "oldPage"
                ? "https://ma-boutique.fr/pages/ambassadeur"
                : null,
        menu: { state: status === "live" ? "added" : "missing" },
        scopes: { proxy: true, menu: true, pages: true },
    };
}

const LOGIN_ERRORS: Record<string, LoginErrorType> = {
    invalid: LoginErrorType.InvalidShop,
    missing: LoginErrorType.MissingShop,
};

const legacyTheme = q.get("theme") === "legacy";

const appLoader = () =>
    ({
        apiKey: "demo",
        businessUrl: "https://business.frak.id",
        env: "prod",
        componentsUrl: "https://sdk.frak.id/components.js",
        shopifyLogoUrl: "/shopify-logo.svg",
        isThemeSupportedPromise: Promise.resolve(!legacyTheme),
        supportsAppEmbedPromise: Promise.resolve(!legacyTheme),
        shop,
        merchantId: onboardingData().merchantId,
        onboardingDataPromise: Promise.resolve(onboardingData()),
    }) satisfies LoaderData<typeof App.loader>;

const settingsLoader = () => {
    const o = onboardingData();
    return {
        merchantInfo: o.merchantId
            ? {
                  merchantId: o.merchantId,
                  productId: "0x01",
                  name: shop.name,
                  domain: shop.normalizedDomain,
              }
            : null,
        webPixel: o.webPixel ?? null,
        merchantId: o.merchantId,
        frakWebhook: { userErrors: [], setup: o.frakWebhook.setup },
        webhooks: o.webhooks,
        theme: {
            isThemeHasFrakActivated: o.isThemeHasFrakActivated,
            theme: o.theme,
            legacyInstallDismissed: false,
            supportsAppEmbed: !legacyTheme,
        },
    } satisfies LoaderData<typeof Settings.loader>;
};

// Flows detect the error page by this text, which AppError prints as its reference.
const ERROR_BOUNDARY_ID = "harness-error-boundary";

function AppErrorBoundary() {
    const error = useRouteError();
    if (isRouteErrorResponse(error)) return <pre>{String(error.status)}</pre>;
    return <AppError error={error} requestId={ERROR_BOUNDARY_ID} />;
}

function AppShell() {
    return (
        <RootProvider>
            <Suspense fallback={<p>…</p>}>
                <Outlet />
            </Suspense>
        </RootProvider>
    );
}

const page = (
    id: string,
    mod: { default: ComponentType },
    loader: () => unknown,
    path?: string
) => ({
    id,
    ...(path ? { path } : { index: true }),
    loader,
    Component: mod.default,
    errorElement: <AppErrorBoundary />,
});

const routes = [
    {
        id: "root",
        path: "/",
        loader: () => ({ locale: lng, requestId: "req-demo-0001" }),
        element: <Outlet />,
        children: [
            {
                id: "routes/app",
                path: "app",
                loader: appLoader,
                element: <AppShell />,
                errorElement: <AppErrorBoundary />,
                children: [
                    page(
                        "routes/app._index",
                        AppIndex,
                        () =>
                            ({
                                campaigns,
                                bankStatus: bankStatus(),
                                legacyInstallDismissed: false,
                            }) satisfies LoaderData<typeof AppIndex.loader>
                    ),
                    page(
                        "routes/app.onboarding",
                        Onboarding,
                        () => ({}),
                        "onboarding"
                    ),
                    page(
                        "routes/app.campaigns",
                        Campaigns,
                        () =>
                            ({
                                campaigns,
                                bankStatus: bankStatus(),
                            }) satisfies LoaderData<typeof Campaigns.loader>,
                        "campaigns"
                    ),
                    page(
                        "routes/app.funding",
                        Funding,
                        () =>
                            ({
                                currentPurchases:
                                    q.get("purchases") === "none"
                                        ? []
                                        : purchases(),
                                bankStatus: bankStatus(),
                            }) satisfies LoaderData<typeof Funding.loader>,
                        "funding"
                    ),
                    page(
                        "routes/app.appearance",
                        Appearance,
                        () =>
                            ({
                                customizations: {},
                                appearanceMetafield: {},
                                isThemeHasFrakButton: q.get("button") === "1",
                                isThemeHasFrakBanner: q.get("banner") === "1",
                                firstProduct: { handle: "t-shirt-bio" },
                                themeId: "1",
                                explorerSettings: null,
                                mediaFiles: [],
                            }) satisfies LoaderData<typeof Appearance.loader>,
                        "appearance"
                    ),
                    page(
                        "routes/app.ambassador",
                        Ambassador,
                        () =>
                            ({
                                overview: ambassadorOverview(),
                                hasActiveCampaign: true,
                                customizeUrl: `https://business.frak.id/m/${MERCHANT_ID}/merchant/customize`,
                                probePromise: Promise.resolve("live" as const),
                            }) satisfies LoaderData<typeof Ambassador.loader>,
                        "ambassador"
                    ),
                    page(
                        "routes/app.settings",
                        Settings,
                        settingsLoader,
                        "settings"
                    ),
                    {
                        id: "routes/app.error",
                        path: "error",
                        loader: () => {
                            throw new Error("Simulated loader failure");
                        },
                        Component: () => null,
                        errorElement: <AppErrorBoundary />,
                    },
                ],
            },
            page(
                "routes/purchase",
                Purchase,
                () =>
                    ({ purchase: purchaseRow() }) satisfies LoaderData<
                        typeof Purchase.loader
                    >,
                "purchase"
            ),
            page(
                "routes/auth.login/route",
                Login,
                () =>
                    ({
                        errors: loginErrorMessage({
                            shop: LOGIN_ERRORS[q.get("error") ?? ""],
                        }),
                    }) satisfies LoaderData<typeof Login.loader>,
                "auth/login"
            ),
        ],
    },
];

await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = POLARIS_URL;
    script.onload = resolve;
    script.onerror = () =>
        reject(new Error(`Polaris failed to load: ${POLARIS_URL}`));
    document.head.append(script);
});

await i18next.use(initReactI18next).init({
    lng,
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    defaultNS,
    resources,
    interpolation,
});
document.documentElement.lang = lng;

// App Bridge's `window.shopify`, used by a few components; outside the admin there is none.
const appBridge: unknown = new Proxy(() => undefined, {
    get: (_t, k) => (k === "then" ? undefined : appBridge),
    apply: () => Promise.resolve(),
});
Object.assign(window, { shopify: appBridge });

const router = createMemoryRouter(routes, {
    initialEntries: [
        (window.location.hash.slice(1) || "/app") + window.location.search,
    ],
});
router.subscribe((state) => {
    if (state.initialized && state.navigation.state === "idle")
        document.documentElement.dataset.harnessReady = "1";
});

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");
createRoot(root).render(
    <StrictMode>
        <I18nextProvider i18n={i18next}>
            <RouterProvider router={router} />
        </I18nextProvider>
    </StrictMode>
);
