"use client";

import { Login } from "@/module/authentication/component/Login";
import { Register } from "@/module/authentication/component/Register";
import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";

// Components that return different children based on the user's authentication state
export function LoginOrRegister() {
    const { wasAuthenticated } = useLastAuthentications();

    // todo
    // This should be smth like a navigation maybe?
    // Like signup, login, recover etc path
    // Having all in the same place isn't ideal at all
    // The auth gate should only perform a redirection to '/login',
    // the login should expose the initial state and softly redirect to either '/register' or '/authentications' based on the state (and later to '/recover' or '/link')

    if (wasAuthenticated) {
        return <Login />;
    }
    return <Register />;
}
