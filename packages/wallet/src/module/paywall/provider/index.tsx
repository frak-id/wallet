"use client";

import {
    type ReactNode,
    createContext,
    useContext,
} from "react";

/**
 * Hook used to store current data about the paywall context
 */
function usePaywallHook() {

    return {
        test: "paywallContext"
    };
}

type UsePaywallHook = ReturnType<typeof usePaywallHook>;
const PaywallContext = createContext<UsePaywallHook | null>(null);

export const usePaywall = (): UsePaywallHook => {
    const context = useContext(PaywallContext);
    if (!context) {
        throw new Error("usePaywall hook must be used within a PaywallProvider");
    }
    return context;
};

export function PaywallProvider({
    children,
}: { children: ReactNode }) {
    const hook = usePaywallHook();

    return (
        <PaywallContext.Provider value={hook}>{children}</PaywallContext.Provider>
    );
}
