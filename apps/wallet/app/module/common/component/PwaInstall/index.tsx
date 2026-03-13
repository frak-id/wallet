import { useEffect } from "react";
import { usePwaInstallRef } from "@/module/common/context/PwaInstallContext";

/**
 * @description Register the pwa-install element.
 *  The @khmyznikov/pwa-install import is loaded dynamically so the side-effecting
 *  web component registration is tree-shaken from Tauri builds.
 */
export function PwaInstall() {
    const pwaInstallRef = usePwaInstallRef();

    // Dynamically import the pwa-install web component
    // This ensures tree-shaking removes it from Tauri builds
    useEffect(() => {
        import("@khmyznikov/pwa-install");
    }, []);

    useEffect(() => {
        const pwaInstall = pwaInstallRef?.current;
        if (!pwaInstall) return;

        pwaInstall.externalPromptEvent = window.promptEvent;
    }, [pwaInstallRef]);

    return (
        <pwa-install
            ref={pwaInstallRef}
            manifest-url="/manifest.json"
            manual-apple="true"
            manual-chrome="true"
        />
    );
}
