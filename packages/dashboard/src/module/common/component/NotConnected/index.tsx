import { Panel } from "@/module/common/component/Panel";
import styles from "./index.module.css";

export function NotConnected() {
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
        </div>
    );
}
