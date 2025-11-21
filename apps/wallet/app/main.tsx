import { isRunningLocally } from "@frak-labs/app-essentials";
import { PendingLoader } from "@frak-labs/ui/component/PendingLoader";
import {
    defaultNS,
    fallbackLng,
    interpolation,
    resources,
    setupBigIntSerialization,
    supportedLngs,
} from "@frak-labs/wallet-shared";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import { StrictMode, startTransition } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";

// Setup BigInt serialization polyfill
setupBigIntSerialization();

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({
    routeTree,
    // Preload routes when links render for instant navigation
    defaultPreload: "render",
    defaultPendingMinMs: 500,
    defaultPendingComponent: PendingLoader,
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
    await i18next
        .use(initReactI18next) // Tell i18next to use the react-i18next plugin
        .use(I18nextBrowserLanguageDetector) // Setup a client-side language detector
        .init({
            defaultNS,
            ns: ["translation", "customized"],
            fallbackLng,
            fallbackNS: "customized",
            supportedLngs,
            resources,
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
}

main().catch((error) => console.error(error));
