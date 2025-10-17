import { cookies } from "next/headers";

/**
 * Server-side utility to check if demo mode is active
 * Checks cookies synced from client-side localStorage
 */
export async function isDemoModeActive(): Promise<boolean> {
    const cookieStore = await cookies();
    const demoModeCookie = cookieStore.get("business_demoMode");
    return demoModeCookie?.value === "true";
}
