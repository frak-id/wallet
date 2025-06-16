import { ButtonLabel } from "@/module/common/component/ButtonLabel";
import { Panel } from "@/module/common/component/Panel";
import { pwaInstallRefAtom } from "@/module/common/component/PwaInstall";
import { useAddToHomeScreenPrompt } from "@/module/common/hook/useAddToHomeScreenPrompt";
import { Button } from "@frak-labs/ui/component/Button";
import { WebApp } from "@frak-labs/ui/icons/WebApp";
import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { Trans } from "react-i18next";
import { trackGenericEvent } from "../../../common/analytics";

export function InstallApp() {
    const { prompt, launchInstallation } = useAddToHomeScreenPrompt();
    const pwaInstallRef = useAtomValue(pwaInstallRefAtom);

    const handleInstall = useCallback(() => {
        trackGenericEvent("install-pwa_initiated");
        if (prompt) {
            launchInstallation();
            return;
        }

        // If the prompt is not available, show the install dialog
        const pwaInstall = pwaInstallRef?.current;
        if (!pwaInstall) return;
        pwaInstall.showDialog(true);
    }, [pwaInstallRef, prompt, launchInstallation]);

    // If the app is already installed, don't show the install button
    if (pwaInstallRef?.current?.isUnderStandaloneMode) {
        return null;
    }

    // If not Apple device, and the prompt is not available, don't show the install button
    if (
        !prompt &&
        !pwaInstallRef?.current?.isAppleMobilePlatform &&
        !pwaInstallRef?.current?.isAppleDesktopPlatform
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
