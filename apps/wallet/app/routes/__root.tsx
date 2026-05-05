import { recordError } from "@frak-labs/wallet-shared";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { BiometricLock } from "@/module/biometrics";
import { ModalOutlet } from "@/module/common/component/ModalOutlet";
import { PwaInstall } from "@/module/common/component/PwaInstall";
import { RootProvider } from "@/module/common/provider/RootProvider";
import { TargetSignatureModal } from "@/module/pairing/component/TargetSignatureModal";
import { DetectPWA } from "@/module/wallet/component/DetectPWA";
// Import open panel to ensure it's initialized
import "@frak-labs/wallet-shared";
// Import global styles
import "@frak-labs/design-system/global";
import { useHardwareBack } from "@/module/common/hook/useHardwareBack";

export const Route = createRootRoute({
    component: RootComponent,
    errorComponent: ErrorComponent,
    notFoundComponent: NotFoundComponent,
});

/**
 * Root component
 *
 * This component wraps the entire application with providers and global components.
 */
function RootComponent() {
    useHardwareBack();

    return (
        <RootProvider>
            {/* Only show PWA features in web mode — tree-shaken in Tauri builds */}
            {!process.env.IS_TAURI && (
                <>
                    <PwaInstall />
                    <DetectPWA />
                </>
            )}
            {process.env.IS_TAURI && <BiometricLock />}
            <Outlet />
            <TargetSignatureModal />
            <ModalOutlet />
            {import.meta.env.DEV && (
                <TanStackRouterDevtools position="bottom-right" />
            )}
        </RootProvider>
    );
}

/**
 * Error boundary component
 *
 * Reports the error to OpenPanel and shows a friendly fallback in
 * production. Stack trace is kept visible in dev to preserve DX.
 */
function ErrorComponent({ error }: { error: Error }) {
    useEffect(() => {
        recordError(error, { source: "react_router" });
    }, [error]);

    if (import.meta.env.DEV) {
        return (
            <div>
                <h1>Error</h1>
                <p>{error?.message}</p>
                <p>The stack trace is:</p>
                <pre>{error?.stack}</pre>
                <button type="button" onClick={() => location.reload()}>
                    Reload
                </button>
            </div>
        );
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "1rem",
                padding: "2rem",
                textAlign: "center",
            }}
        >
            <h1>Something went wrong</h1>
            <p>We hit an unexpected error. Please try again.</p>
            <button type="button" onClick={() => location.reload()}>
                Reload
            </button>
        </div>
    );
}

/**
 * Not found component
 *
 * Displayed when a route is not found.
 */
function NotFoundComponent() {
    return (
        <div>
            <h1>404 - Page Not Found</h1>
            <p>The page you're looking for doesn't exist.</p>
        </div>
    );
}
