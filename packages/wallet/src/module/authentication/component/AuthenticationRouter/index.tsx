"use client";

import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";
import { useRouter } from "next/navigation";
import { type PropsWithChildren, useEffect } from "react";

// Components that redirect based on the user's authentication state
export function AuthenticationRouter({ children }: PropsWithChildren) {
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
