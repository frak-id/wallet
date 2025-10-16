import "@khmyznikov/pwa-install";
import type { PWAInstallElement } from "@khmyznikov/pwa-install";
import { atom, useAtomValue } from "jotai";
import { createRef, type RefObject, useEffect } from "react";

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
