"use client";

import { AccordionLogin } from "@/module/authentication/component/AccordionLogin";
import { LoginItem } from "@/module/authentication/component/LoginItem";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { HardDrive } from "lucide-react";

export function LoginList() {
    const { data: previousAuthenticators } = usePreviousAuthenticators();

    return (
        (previousAuthenticators?.length ?? 0) > 0 && (
            <AccordionLogin
                trigger={
                    <>
                        <HardDrive /> Wallets used on this device
                    </>
                }
            >
                <ul>
                    {previousAuthenticators?.map((auth) => (
                        <LoginItem
                            key={`${auth.wallet}`}
                            lastAuthentication={auth}
                        />
                    ))}
                </ul>
            </AccordionLogin>
        )
    );
}
