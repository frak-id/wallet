import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { RefreshCcw } from "lucide-react";
import type { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { BasePairingClient } from "../../clients/base";
import styles from "./index.module.css";

type Status = "success" | "waiting" | "loading" | "error";

// Loose alias — we only need access to .store/.reset/.reconnect, the generics
// are unused here so we accept any subclass.
// biome-ignore lint/suspicious/noExplicitAny: structural client prop
type AnyPairingClient = BasePairingClient<any, any, any>;

/**
 * StatusBoxWallet is a component that displays a status icon and a title.
 * It is used to display the status of a pairing process on wallet.
 *
 * @param status - The status of the pairing process.
 * @param title - The title of the pairing process.
 * @param children - The children of the pairing process.
 */
export function StatusBoxWallet({
    status,
    title,
    client,
    children,
}: PropsWithChildren<{
    status: Status;
    title: string;
    client?: AnyPairingClient;
}>) {
    return (
        <div className={styles.statusBoxWalletContainer}>
            <div className={styles.statusBox}>
                <InnerStatusBox status={status} title={title} />
            </div>
            {client && <StatusBoxRetry client={client} />}
            {children}
        </div>
    );
}

/**
 * StatusBoxModal is a component that displays a status icon and a title.
 * It is used to display the status of a pairing process on shared modal.
 *
 * @param status - The status of the pairing process.
 * @param title - The title of the pairing process.
 * @param children - The children of the pairing process.
 */
export function StatusBoxModal({
    status,
    title,
    client,
    children,
}: PropsWithChildren<{
    status: Status;
    title: string;
    client?: AnyPairingClient;
}>) {
    return (
        <div className={styles.statusBoxModalContainer}>
            <div className={styles.statusBox}>
                <InnerStatusBox status={status} title={title} />
            </div>
            {client && <StatusBoxRetry client={client} />}
            {children}
        </div>
    );
}

/**
 * StatusBoxWalletEmbedded is a component that displays a status icon and a title.
 * It is used to display the status of a pairing process on wallet embedded.
 *
 * @param status - The status of the pairing process.
 * @param title - The title of the pairing process.
 * @param children - The children of the pairing process.
 */
export function StatusBoxWalletEmbedded({
    status,
    title,
    client,
    children,
}: PropsWithChildren<{
    status: Status;
    title: string;
    client?: AnyPairingClient;
}>) {
    return (
        <div className={styles.statusBoxWalletEmbeddedContainer}>
            <div className={styles.statusBox}>
                <InnerStatusBox status={status} title={title} />
            </div>
            {client && <StatusBoxRetry client={client} />}
            {children}
        </div>
    );
}

/**
 * StatusBoxRefresh is a component that displays a refresh button.
 * It is used to refresh the pairing process.
 */
function StatusBoxRetry({ client }: { client: AnyPairingClient }) {
    const state = useStore(client.store);
    const { t } = useTranslation();
    const code = state.closeInfo?.code;
    const reason = state.closeInfo?.reason;

    if (state.status !== "retry-error" && state.status !== "error") return null;

    const isFatal = state.status === "error";
    const onClick = () => {
        if (isFatal) {
            client.reset();
        } else {
            client.reconnect();
        }
    };
    const label = isFatal
        ? t("wallet.pairing.reconnect")
        : t("wallet.pairing.refresh");

    return (
        <>
            <button
                type="button"
                className={styles.statusBox__retry}
                onClick={onClick}
            >
                <RefreshCcw size={12} />
                {label}
            </button>
            {(code || reason) && (
                <p className={styles.statusBox__retryText}>
                    {code && (
                        <span className={styles.statusBox__retryTextItem}>
                            {t("wallet.pairing.refreshCode")} {code}
                        </span>
                    )}
                    {reason && (
                        <span className={styles.statusBox__retryTextItem}>
                            {t("wallet.pairing.refreshReason")} {reason}
                        </span>
                    )}
                </p>
            )}
        </>
    );
}

function InnerStatusBox({ status, title }: { status: Status; title: string }) {
    const icon = getIcon(status);

    return (
        <>
            <div>{icon}</div>
            <div className={styles.statusBox__content}>
                <p className={styles.statusBox__title}>{title}</p>
            </div>
        </>
    );
}

function getIcon(status: Status) {
    switch (status) {
        case "success":
            return <GreenDot />;
        case "waiting":
            return <AmberDot />;
        case "loading":
            return <Spinner />;
        case "error":
            return <RedDot />;
        default:
            return <GreenDot />;
    }
}

function GreenDot() {
    return (
        <div
            className={`${styles.statusBox__indicator} ${styles["statusBox__indicator--green"]}`}
        />
    );
}

function AmberDot() {
    return (
        <div
            className={`${styles.statusBox__indicator} ${styles["statusBox__indicator--amber"]}`}
        />
    );
}

function RedDot() {
    return (
        <div
            className={`${styles.statusBox__indicator} ${styles["statusBox__indicator--red"]}`}
        />
    );
}
