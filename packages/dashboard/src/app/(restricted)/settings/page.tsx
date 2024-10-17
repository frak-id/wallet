"use client";

import { deleteSession } from "@/context/auth/actions/session";
import { Button } from "@module/component/Button";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
    const router = useRouter();

    return (
        <>
            <h1>Settings</h1>
            <Button
                onClick={() => {
                    deleteSession().then(() => {
                        router.push("/login");
                    });
                }}
            >
                Logout
            </Button>
        </>
    );
}
