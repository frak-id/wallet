import { Button } from "@frak-labs/ui/component/Button";
import { WebApp } from "@frak-labs/ui/icons/WebApp";
import { trackGenericEvent } from "@frak-labs/wallet-shared/common/analytics";
import { useAddToHomeScreenPrompt } from "@frak-labs/wallet-shared/common/hook/useAddToHomeScreenPrompt";
import { useCallback, useEffect, useState } from "react";
import { Trans } from "react-i18next";
import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { usePwaInstallRef } from "@/module/common/context/PwaInstallContext";

type PwaInstallState = {
    isUnderStandaloneMode: boolean;
    isAppleMobilePlatform: boolean;
    isAppleDesktopPlatform: boolean;
};

export function InstallApp() {
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
        <Panel variant={"invisible"} size={"none"}>
            <Button
                blur={"blur"}
                width={"full"}
                align={"left"}
                gap={"big"}
                onClick={handleInstall}
                leftIcon={<WebApp />}
            >
                <ButtonLabel>
                    <Trans i18nKey={"wallet.installWebApp"} />
                </ButtonLabel>
            </Button>
        </Panel>
    );
}
