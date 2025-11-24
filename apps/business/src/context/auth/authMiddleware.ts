import { createMiddleware, createServerOnlyFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";
import { type JWTPayload, jwtVerify } from "jose";
import { type Address, zeroAddress } from "viem";

const getBusinessSecret = createServerOnlyFn(() =>
    new TextEncoder().encode(process.env.JWT_BUSINESS_SECRET)
);

/**
 * Authentication middleware that reads auth token from cookies
 * Works for both SSR and client-side server function calls
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(
    async ({ next }) => {
        // Read token from cookie (available during SSR and client-side calls)
        const token = getCookie("business-auth");

        // Validate token is present
        if (!token) {
            throw new Error("No authenticated wallet found");
        }

        // Check for demo token
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
            const { payload } = await jwtVerify<
                JWTPayload & { wallet: Address }
            >(token, getBusinessSecret());

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
    }
);
