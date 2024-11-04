import { Medal } from "@module/asset/icons/Medal";
import { ButtonRefresh } from "@module/component/ButtonRefresh";
import { Link } from "@remix-run/react";
import { HandCoins, RefreshCcw, Send } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./index.module.css";

export function HomeNavigation() {
    return (
        <div className={styles.homeNavigation}>
            <Link
                to={"/share-and-earn"}
                className={`${styles.button} ${styles.button__lines}`}
            >
                <Button icon={<Medal />}>
                    Share
                    <br />& Earn
                </Button>
            </Link>
            <Link to={"/tokens/receive"} className={styles.button}>
                <Button
                    icon={<HandCoins size={36} absoluteStrokeWidth={true} />}
                >
                    Receive
                </Button>
            </Link>
            <Link to={"/tokens/send"} className={styles.button}>
                <Button icon={<Send size={26} absoluteStrokeWidth={true} />}>
                    Send
                </Button>
            </Link>
            <ButtonRefresh className={styles.button}>
                <Button icon={<RefreshCcw size={24} />}>Refresh</Button>
            </ButtonRefresh>
        </div>
    );
}

function Button({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <>
            <span className={styles.button__icon}>{icon}</span>
            {children}
        </>
    );
}
