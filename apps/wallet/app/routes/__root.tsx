import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { recordError } from "@frak-labs/wallet-shared";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useEffect } from "react";
import { BiometricLock } from "@/module/biometrics";
import { FullScreenGate } from "@/module/common/component/FullScreenGate";
import { ModalOutlet } from "@/module/common/component/ModalOutlet";
import { PwaInstall } from "@/module/common/component/PwaInstall";
import { RootProvider } from "@/module/common/provider/RootProvider";
import { TargetSignatureModal } from "@/module/pairing/component/TargetSignatureModal";
import { VersionGate } from "@/module/version";
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
            {process.env.IS_TAURI && <VersionGate />}
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
 * Reports the error to OpenPanel and surfaces a styled fallback via
 * `FullScreenGate` so the failure mode looks like an intentional state
 * rather than a broken page. The full stack trace stays accessible via
 * `console.error` (React + TanStack Router both log it).
 */
function ErrorComponent({ error }: { error: Error }) {
    useEffect(() => {
        recordError(error, { source: "react_router" });
    }, [error]);

    return (
        <FullScreenGate
            title="Something went wrong"
            description={
                <Text variant="bodySmall">
                    We hit an unexpected error. Please try again.
                </Text>
            }
            action={<Button onClick={() => location.reload()}>Reload</Button>}
        />
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
