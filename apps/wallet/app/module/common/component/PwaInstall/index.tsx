import "@khmyznikov/pwa-install";
import type { PWAInstallElement } from "@khmyznikov/pwa-install";
import { atom, useAtomValue } from "jotai";
import { type RefObject, createRef, useEffect } from "react";

/**
 * @description Keep the pwa-install element to be used elsewhere.
 *
 * @example
 *
 * const pwaInstallRef = useAtomValue(pwaInstallRefAtom);
 *
 * @returns {RefObject<PWAInstallElement | null>}
 */
export const pwaInstallRefAtom = atom<RefObject<PWAInstallElement | null>>(
    createRef<PWAInstallElement>()
);

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
            // biome-ignore lint/security/noDangerouslySetInnerHtml:
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
    const pwaInstallRef = useAtomValue(pwaInstallRefAtom);

    useEffect(() => {
        const pwaInstall = pwaInstallRef?.current;
        if (!pwaInstall) return;

        // @ts-ignore
        pwaInstall.externalPromptEvent = window.promptEvent;
    }, [pwaInstallRef]);

    return (
        // @ts-ignore
        <pwa-install
            ref={pwaInstallRef}
            manifest-url="/manifest.json"
            manual-apple="true"
            manual-chrome="true"
        />
    );
}
