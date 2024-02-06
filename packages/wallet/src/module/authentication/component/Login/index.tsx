"use client";

import { useLogin } from "@/module/authentication/hook/useLogin";
import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";

/**
 * Login from previous authentication
 * TODO: Flow for account recovery will be pretty simlar, just not listing previous authentications, just inputting the username
 * @constructor
 */
export function Login() {
    const { lastAuthentications } = useLastAuthentications();
    const { login, setSelectedUsername } = useLogin();

    return (
        <div>
            <h1>Login</h1>
            <p>Choose an account to login with</p>
            <ul>
                {lastAuthentications?.map((auth) => (
                    <li key={auth.username}>
                        <button
                            type={"button"}
                            onClick={() => {
                                // TODO: This could be merge in the same function??
                                setSelectedUsername(auth.username);
                                login();
                            }}
                        >
                            {auth.username}
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
