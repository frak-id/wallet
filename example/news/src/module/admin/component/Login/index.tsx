"use client";

import { performAdminLogin } from "@/context/admin/action/authenticate";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

export function AdminLogin() {
    const [password, setPassword] = useState<string>("");

    const {
        isPending,
        mutate: login,
        error,
    } = useMutation({
        mutationKey: ["adminLogin"],
        mutationFn: performAdminLogin,
    });

    return (
        <div>
            <h1>Admin Login</h1>
            <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button
                onClick={() => login(password)}
                disabled={isPending}
                type="button"
            >
                Login
            </button>

            <br />
            {error && <p>{error.message}</p>}
        </div>
    );
}
