import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Server-side utility to check if demo mode is active
 * Checks cookies synced from client-side localStorage
 */
export async function isDemoModeActive(): Promise<boolean> {
    const cookies = getRequestHeader("cookie") || "";
    const demoModeCookie = cookies
        .split(";")
        .find((c) => c.trim().startsWith("business_demoMode="));
    return demoModeCookie?.split("=")[1] === "true";
}
