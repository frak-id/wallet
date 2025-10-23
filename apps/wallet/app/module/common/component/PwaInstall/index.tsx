import "@khmyznikov/pwa-install";
import type { PWAInstallElement } from "@khmyznikov/pwa-install";
import { createRef, useEffect } from "react";
import { pwaInstallStore } from "@/module/stores/pwaInstallStore";

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
    const pwaInstallRef = createRef<PWAInstallElement>();

    useEffect(() => {
        // Store the ref in Zustand for access elsewhere
        pwaInstallStore.getState().setPwaInstallRef(pwaInstallRef);

        return () => {
            // Clean up when component unmounts
            pwaInstallStore.getState().setPwaInstallRef(null);
        };
    }, [pwaInstallRef]);

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
