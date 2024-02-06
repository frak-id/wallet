"use client";

import { LoginList } from "@/module/authentication/component/LoginList";
import Link from "next/link";

/**
 * Login from previous authentication
 * TODO: Flow for account recovery will be pretty simlar, just not listing previous authentications, just inputting the username
 * @constructor
 */
export function Login() {
    return (
        <>
            <LoginList />
            <Link href={"/register"} title="Frak">
                Create new account
            </Link>
        </>
    );
}
