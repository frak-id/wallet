"use client";

import { Panel } from "@/module/common/component/Panel";
import { useSiweAuthenticate } from "@frak-labs/nexus-sdk/react";
import { ButtonRipple } from "@frak-labs/nexus-wallet/src/module/common/component/ButtonRipple";
import { useEffect } from "react";
import styles from "./index.module.css";

export function NotConnected() {
    const {
        mutate: authenticate,
        error,
        status,
        data: authResult,
    } = useSiweAuthenticate();

    useEffect(() => {
        console.log("Siwe auth result", { status, error, authResult });
    }, [error, status, authResult]);

    return (
        <div className={styles.notConnected}>
            <Panel>
                You are not connected, please login to{" "}
                <a
                    href={process.env.NEXUS_WALLET_URL}
                    target={"_blank"}
                    rel="noreferrer"
                    className={styles.notConnected__link}
                >
                    your Nexus Wallet
                </a>
            </Panel>

            <br />
            <br />

            <ButtonRipple
                onClick={() =>
                    authenticate({
                        context: "Test authentication",
                        siwe: {},
                    })
                }
            >
                Direct auth
            </ButtonRipple>
        </div>
    );
}
