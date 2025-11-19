import { createMiddleware } from "@tanstack/react-start";
import type { Address } from "viem";
import { useAuthStore } from "@/stores/authStore";

/**
 * Authentication middleware that injects wallet address and demo mode from client to server
 * This allows server functions to access the authenticated wallet and demo mode without cookies
 */
export const authMiddleware = createMiddleware({ type: "function" })
    .client(async ({ next }) => {
        // Get the wallet address and demo mode from stores on the client
        const authState = useAuthStore.getState();
        const wallet = authState.wallet;
        const isDemoMode = authState.isDemoMode;

        // Send them to the server via context
        return next({
            sendContext: {
                wallet: wallet as Address,
                isDemoMode,
            },
        });
    })
    .server(async ({ next, context }) => {
        // In demo mode, use a demo wallet if no wallet is present
        const wallet =
            context.wallet ||
            (context.isDemoMode
                ? ("0x0000000000000000000000000000000000000001" as Address)
                : null);

        // Validate wallet is present (either real or demo)
        if (!wallet) {
            throw new Error("No authenticated wallet found");
        }

        // Pass wallet and demo mode along to server functions
        return next({
            context: {
                wallet,
                isDemoMode: context.isDemoMode || false,
            },
        });
    });
