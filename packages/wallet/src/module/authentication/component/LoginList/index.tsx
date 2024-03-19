"use client";

import { AccordionLogin } from "@/module/authentication/component/AccordionLogin";
import { LoginItem } from "@/module/authentication/component/LoginItem";
import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";
import { HardDrive } from "lucide-react";

export function LoginList() {
    const { previousAuthenticators } = useLastAuthentications();
    return (
        previousAuthenticators.length > 0 && (
            <AccordionLogin
                trigger={
                    <>
                        <HardDrive /> Nexus used on this device
                    </>
                }
            >
                <ul>
                    {previousAuthenticators.map((auth) => (
                        <LoginItem
                            key={`${auth.username}-${auth.wallet}`}
                            lastAuthentication={auth}
                        />
                    ))}
                </ul>
            </AccordionLogin>
        )
    );
}
