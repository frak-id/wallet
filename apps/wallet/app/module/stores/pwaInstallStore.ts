import type { PWAInstallElement } from "@khmyznikov/pwa-install";
import type { RefObject } from "react";
import { create } from "zustand";

type PwaInstallState = {
    /**
     * React ref to the pwa-install web component
     * Used to programmatically trigger install dialogs
     */
    pwaInstallRef: RefObject<PWAInstallElement | null> | null;
};

type PwaInstallActions = {
    /**
     * Set the PWA install element ref
     */
    setPwaInstallRef: (ref: RefObject<PWAInstallElement | null> | null) => void;
};

export const pwaInstallStore = create<PwaInstallState & PwaInstallActions>()(
    (set) => ({
        pwaInstallRef: null,

        setPwaInstallRef: (pwaInstallRef) => set({ pwaInstallRef }),
    })
);

/**
 * Selectors for PWA install state
 */
export const selectPwaInstallRef = (
    state: PwaInstallState & PwaInstallActions
) => state.pwaInstallRef;
