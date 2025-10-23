import type { PWAInstallElement } from "@khmyznikov/pwa-install";
import {
    createContext,
    type PropsWithChildren,
    type RefObject,
    useContext,
    useRef,
} from "react";

type PwaInstallContextValue = RefObject<PWAInstallElement | null>;

const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);

export function PwaInstallProvider({ children }: PropsWithChildren) {
    const pwaInstallRef = useRef<PWAInstallElement | null>(null);

    return (
        <PwaInstallContext.Provider value={pwaInstallRef}>
            {children}
        </PwaInstallContext.Provider>
    );
}

export function usePwaInstallRef() {
    const context = useContext(PwaInstallContext);
    if (!context) {
        throw new Error(
            "usePwaInstallRef must be used within PwaInstallProvider"
        );
    }
    return context;
}
