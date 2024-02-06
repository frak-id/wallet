"use client";

import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { PropsWithChildren } from "react";

// Components that redirect based on the user's authentication state
export function LoginOrRegister({ children }: PropsWithChildren) {
    const router = useRouter();
    const { wasAuthenticated } = useLastAuthentications();

    useEffect(() => {
        if (wasAuthenticated) {
            router.push("/login");
            return;
        }
        router.push("/register");
    }, [router, wasAuthenticated]);

    return children;
}
