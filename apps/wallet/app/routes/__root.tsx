import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { BiometricLock } from "@/module/biometrics";
import { ModalOutlet } from "@/module/common/component/ModalOutlet";
import { PwaInstall } from "@/module/common/component/PwaInstall";
import { RootProvider } from "@/module/common/provider/RootProvider";
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
 * Handles errors that occur during route rendering.
 */
function ErrorComponent({ error }: { error: Error }) {
    if (error instanceof Error) {
        return (
            <div>
                <h1>Error</h1>
                <p>{error.message}</p>
                <p>The stack trace is:</p>
                <pre>{error.stack}</pre>
            </div>
        );
    }

    return <h1>Unknown Error</h1>;
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
