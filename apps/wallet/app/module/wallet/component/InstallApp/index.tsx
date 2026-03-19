import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import {
    trackGenericEvent,
    useAddToHomeScreenPrompt,
} from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useState } from "react";
import { Trans } from "react-i18next";
import { usePwaInstallRef } from "@/module/common/context/PwaInstallContext";

type PwaInstallState = {
    isUnderStandaloneMode: boolean;
    isAppleMobilePlatform: boolean;
    isAppleDesktopPlatform: boolean;
};

export function InstallApp() {
    // PWA install is not relevant for native Tauri apps
    if (isTauri()) {
        return null;
    }

    return <InstallAppContent />;
}

function WebAppIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="49"
            fill="none"
            viewBox="0 0 48 49"
            {...props}
        >
            <title>WebApp</title>
            <path
                fill="#fff"
                d="M17.143 21.432H3.429A3.428 3.428 0 010 18.003V4.29A3.429 3.429 0 013.429.86h13.714A3.428 3.428 0 0120.57 4.29v13.714a3.429 3.429 0 01-3.428 3.429zM3.429 4.289v13.714h13.714V4.29zM17.143 48.86H3.429A3.429 3.429 0 010 45.432V31.717a3.429 3.429 0 013.429-3.428h13.714a3.428 3.428 0 013.428 3.428v13.715a3.428 3.428 0 01-3.428 3.428zM3.429 31.717v13.715h13.714V31.717zM44.57 21.432H30.857a3.428 3.428 0 01-3.428-3.429V4.29A3.428 3.428 0 0130.857.86h13.714A3.429 3.429 0 0148 4.29v13.714a3.429 3.429 0 01-3.429 3.429zM30.857 4.289v13.714h13.714V4.29zM46.286 36.86h-6.857v-6.857a1.714 1.714 0 00-3.429 0v6.857h-6.857a1.714 1.714 0 100 3.429H36v6.857a1.714 1.714 0 103.429 0V40.29h6.857a1.714 1.714 0 100-3.429z"
            />
        </svg>
    );
}

function InstallAppContent() {
    const { prompt, launchInstallation } = useAddToHomeScreenPrompt();
    const pwaInstallRef = usePwaInstallRef();
    const [pwaState, setPwaState] = useState<PwaInstallState>({
        isUnderStandaloneMode: false,
        isAppleMobilePlatform: false,
        isAppleDesktopPlatform: false,
    });

    // Track PWA element state in React state (don't read ref during render)
    useEffect(() => {
        const pwaInstall = pwaInstallRef.current;
        if (!pwaInstall) return;

        setPwaState({
            isUnderStandaloneMode: pwaInstall.isUnderStandaloneMode ?? false,
            isAppleMobilePlatform: pwaInstall.isAppleMobilePlatform ?? false,
            isAppleDesktopPlatform: pwaInstall.isAppleDesktopPlatform ?? false,
        });
    }, [pwaInstallRef]);

    const handleInstall = useCallback(() => {
        trackGenericEvent("install-pwa_initiated");
        if (prompt) {
            launchInstallation();
            return;
        }

        // If the prompt is not available, show the install dialog
        const pwaInstall = pwaInstallRef.current;
        if (!pwaInstall) return;
        pwaInstall.showDialog(true);
    }, [pwaInstallRef, prompt, launchInstallation]);

    // If the app is already installed, don't show the install button
    if (pwaState.isUnderStandaloneMode) {
        return null;
    }

    // If not Apple device, and the prompt is not available, don't show the install button
    if (
        !prompt &&
        !pwaState.isAppleMobilePlatform &&
        !pwaState.isAppleDesktopPlatform
    ) {
        return null;
    }

    return (
        <Button onClick={handleInstall} icon={<WebAppIcon />}>
            <Box as="span">
                <Trans i18nKey={"wallet.installWebApp"} />
            </Box>
        </Button>
    );
}
