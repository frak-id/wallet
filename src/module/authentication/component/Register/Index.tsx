"use client";

import { useRegister } from "@/module/authentication/hook/useRegister";

export function TestRegister() {
    const { username } = useRegister();

    return (
        <div>
            <p>Test username {username}</p>
        </div>
    );
}
