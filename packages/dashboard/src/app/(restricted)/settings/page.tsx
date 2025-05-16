"use client";

import { deleteSession } from "@/context/auth/actions/session";
import { Head } from "@/module/common/component/Head";
import { Panel } from "@/module/common/component/Panel";
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
            <Head title={{ content: "Settings" }} />

            <Panel title="Wallet">
                <p className={styles.walletAddress}>
                    Your wallet address is {walletStatus?.wallet}
                </p>
            </Panel>

            <Panel title="Currency">
                <SelectCurrency />
            </Panel>

            <Panel title="Logout">
                <p>You will be logged out of your account.</p>
                <Button
                    variant={"submit"}
                    className={styles.logoutButton}
                    onClick={() => {
                        deleteSession().then(() => {
                            router.push("/login");
                        });
                    }}
                >
                    Logout
                </Button>
            </Panel>
        </>
    );
}
