import "@khmyznikov/pwa-install";
import { useEffect } from "react";
import { usePwaInstallRef } from "@/module/common/context/PwaInstallContext";

/**
 * @description Register the beforeinstallprompt event.
 *
 * @example
 *
 * <PwaInstallScript />
 *
 * @returns {JSX.Element}
 */
export function PwaInstallScript() {
    return (
        <script
            dangerouslySetInnerHTML={{
                __html: `
                    window.addEventListener("beforeinstallprompt", (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();

                        // save it somewhere
                        window.promptEvent = e;
                    });
                `,
            }}
        />
    );
}

/**
 * @description Register the pwa-install element.
 *
 * @example
 *
 * <PwaInstall />
 *
 * @returns {JSX.Element}
 */
export function PwaInstall() {
    const pwaInstallRef = usePwaInstallRef();

    useEffect(() => {
        const pwaInstall = pwaInstallRef?.current;
        if (!pwaInstall) return;

        pwaInstall.externalPromptEvent = window.promptEvent;
    }, [pwaInstallRef]);

    return (
        // @ts-expect-error
        <pwa-install
            ref={pwaInstallRef}
            manifest-url="/manifest.json"
            manual-apple="true"
            manual-chrome="true"
        />
    );
}
