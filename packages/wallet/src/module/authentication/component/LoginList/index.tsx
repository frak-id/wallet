"use client";

import { LoginItem } from "@/module/authentication/component/LoginItem";
import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";

export function LoginList() {
    const { previousAuthenticators } = useLastAuthentications();

    return (
        <ul>
            {previousAuthenticators.map((auth) => (
                <LoginItem
                    key={`${auth.username}-${auth.wallet}`}
                    lastAuthentication={auth}
                />
            ))}
        </ul>
    );
}
