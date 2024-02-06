import { getSession } from "@/context/session/action/session";
import { LoginOrRegister } from "@/module/authentication/component/LoginOrRegister";
import { LastAuthenticationsProvider } from "@/module/authentication/providers/LastAuthentication";
import type { ReactNode } from "react";

type AuthGateProps = {
    children: ReactNode;
};

/**
 * The authentication gate to display if a user isn't logged in
 * This is a server component, todo: is transition possible here?
 */
export async function AuthGate({ children }: AuthGateProps) {
    // Check if a user is logged in or not
    const currentSession = await getSession();

    // TODO: Add transition on state changes?

    // If we don't have any current session, display the auth stuff
    if (!currentSession) {
        return (
            <LastAuthenticationsProvider>
                <LoginOrRegister>{children}</LoginOrRegister>
            </LastAuthenticationsProvider>
        );
    }

    return <>{children}</>;
}
