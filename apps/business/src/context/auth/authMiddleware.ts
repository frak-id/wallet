import { createMiddleware } from "@tanstack/react-start";
import { type JWTPayload, jwtVerify } from "jose";
import { type Address, zeroAddress } from "viem";
import { useAuthStore } from "@/stores/authStore";

/**
 * Authentication middleware that injects wallet address and demo mode from client to server
 * This allows server functions to access the authenticated wallet and demo mode without cookies
 */
export const authMiddleware = createMiddleware({ type: "function" })
    .client(async ({ next }) => {
        // Get the token from stores on the client
        // During SSR, this will be undefined/null which is fine
        const authState = useAuthStore.getState();
        const token = authState.token ?? null;

        // Send it to the server via context
        return next({
            sendContext: {
                token,
            },
        });
    })
    .server(async ({ next, context }) => {
        const token = context?.token;

        // Check for demo token first (before validating token presence)
        if (token === "demo-token") {
            return next({
                context: {
                    wallet: zeroAddress as Address,
                    isDemoMode: true,
                },
            });
        }

        // Validate token is present
        if (!token) {
            throw new Error("No authenticated wallet found");
        }

        // Regular token parsing
        try {
            const secret = new TextEncoder().encode(
                process.env.JWT_BUSINESS_SECRET
            );
            const { payload } = await jwtVerify<
                JWTPayload & { wallet: Address }
            >(token, secret);

            // No need to validate schema as we are doing on the backend, just extract the wallet
            return next({
                context: {
                    wallet: payload.wallet,
                    isDemoMode: false,
                },
            });
        } catch (e) {
            // Token invalid or expired
            console.error("Auth middleware: Invalid token", e);
            throw new Error("Unable to parse the token");
        }
    });
