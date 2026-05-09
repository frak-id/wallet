import { isRunningLocally } from "@frak-labs/app-essentials";
import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    recordError,
    setupBigIntSerialization,
    supportedLngs,
} from "@frak-labs/wallet-shared";
import { initAnalytics } from "@frak-labs/wallet-shared/common/analytics";
import {
    customized as frCustomized,
    translation as frTranslation,
} from "@frak-labs/wallet-shared/i18n/locales/fr";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { initDeepLinks } from "./utils/deepLink";
import { initSafeAreaInsets } from "./utils/safeArea";

// Setup BigInt serialization polyfill
setupBigIntSerialization();

// Initialise analytics (OpenPanel + crashlytics globals) once at bootstrap.
// Side-effect was previously triggered by importing the analytics module;
// the explicit call keeps tree-shaking honest now that the side-effect is gone.
initAnalytics();

// Lazy-load the English bundle on demand. French is bundled (it's our
// fallbackLng), so most loads skip the ~13 KB gzipped EN payload. Registered
// before init() so the initial `languageChanged` event from the detector is
// captured.
i18next.on("languageChanged", async (lng) => {
    if (lng === "en" && !i18next.hasResourceBundle("en", "translation")) {
        const { translation, customized } = await import(
            "@frak-labs/wallet-shared/i18n/locales/en"
        );
        i18next.addResourceBundle("en", "translation", translation);
        i18next.addResourceBundle("en", "customized", customized);
    }
});

// Wire global JS error reporting BEFORE anything else can throw — this
// catches errors emitted during module evaluation, the i18next init, or
// async work kicked off below. `recordError` no-ops when OpenPanel is not
// configured, so it's safe everywhere.
if (typeof window !== "undefined") {
    window.addEventListener("error", (event) => {
        recordError(event.error ?? event.message, {
            source: "window_error",
            context: {
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
            },
        });
    });
    window.addEventListener("unhandledrejection", (event) => {
        recordError(event.reason, { source: "unhandled_rejection" });
    });
}

// Inject Apple Smart App Banner only when the native app is available
if (process.env.IS_APP_AVAILABLE === "true") {
    const meta = document.createElement("meta");
    meta.name = "apple-itunes-app";
    meta.content = "app-id=6740261164";
    document.head.appendChild(meta);
}

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({
    routeTree,
    // Preload routes when links render for instant navigation
    defaultPreload: "render",
    defaultPendingMinMs: 500,
    scrollRestoration: true,
    scrollToTopSelectors: ["main"],
    // Browsers without `document.startViewTransition` (Firefox, Safari < 18)
    // gracefully fall through to instant navigation. We skip the transition
    // on the very first navigation (no `fromLocation`) so the boot path —
    // which often awaits route loaders, lazy chunks, and smart-wallet init —
    // never trips Chromium's ~4s DOM-update timeout ("Transition was aborted
    // because of timeout in DOM update").
    defaultViewTransition: {
        types: ({ pathChanged, fromLocation }) =>
            fromLocation && pathChanged ? ["page"] : false,
    },
});

// Subscribe to navigation events to manage root element attributes
router.subscribe("onResolved", ({ toLocation }) => {
    const rootElement = document.querySelector(":root") as HTMLElement;
    if (!rootElement) return;

    // Set data-page attribute based on route
    if (toLocation.pathname.startsWith("/sso")) {
        rootElement.dataset.page = "sso";
    } else {
        rootElement.removeAttribute("data-page");
    }
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

async function main() {
    // Initialize Tauri-specific features for mobile devices
    if (IS_TAURI) {
        await initSafeAreaInsets();
        await initDeepLinks((options) => {
            return router.navigate(
                options as Parameters<typeof router.navigate>[0]
            );
        });
    }

    await i18next
        .use(initReactI18next) // Tell i18next to use the react-i18next plugin
        .use(I18nextBrowserLanguageDetector) // Setup a client-side language detector
        .init({
            defaultNS,
            ns: ["translation", "customized"],
            fallbackLng,
            fallbackNS: "customized",
            supportedLngs,
            partialBundledLanguages: true,
            resources: {
                fr: {
                    translation: frTranslation,
                    customized: frCustomized,
                },
            },
            debug: isRunningLocally,
            interpolation,

            detection: {
                order: [
                    "querystring",
                    "cookie",
                    "sessionStorage",
                    "localStorage",
                    "navigator",
                ],
            },
        });

    const rootElement = document.getElementById("root");
    if (!rootElement) {
        throw new Error("Root element not found");
    }

    startTransition(() => {
        const root = createRoot(rootElement);
        root.render(
            <I18nextProvider i18n={i18next}>
                <StrictMode>
                    <RouterProvider router={router} />
                </StrictMode>
            </I18nextProvider>
        );
    });

    // Dismiss native splash screen (Android holds it via setKeepOnScreenCondition)
    if (IS_TAURI) {
        (
            window as unknown as {
                NativeSplash?: { dismiss(): void };
            }
        ).NativeSplash?.dismiss();
    }
}

main().catch((error) => recordError(error, { source: "bootstrap" }));
