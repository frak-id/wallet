"use client";

import { deleteSession } from "@/context/auth/actions/session";
import { SelectCurrency } from "@/module/settings/SelectCurrency";
import { useWalletStatus } from "@frak-labs/react-sdk";
import { Button } from "@shared/module/component/Button";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

export default function SettingsPage() {
    const router = useRouter();
    const { data: walletStatus } = useWalletStatus();

    return (
        <>
            <h1>Settings</h1>
            <p className={styles.walletAddress}>
                Your wallet address is {walletStatus?.wallet}
            </p>

            <SelectCurrency />

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
