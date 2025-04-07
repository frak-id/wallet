import { Spinner } from "@shared/module/component/Spinner";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type Status = "success" | "waiting" | "loading" | "error";

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
    children,
}: PropsWithChildren<{
    status: Status;
    title: string;
}>) {
    return (
        <>
            <div className={`${styles.statusBox} ${styles.statusBoxWallet}`}>
                <InnerStatusBox status={status} title={title} />
            </div>
            {children}
        </>
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
    children,
}: PropsWithChildren<{
    status: Status;
    title: string;
}>) {
    return (
        <>
            <div className={`${styles.statusBox} ${styles.statusBoxModal}`}>
                <InnerStatusBox status={status} title={title} />
            </div>
            {children}
        </>
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
    children,
}: PropsWithChildren<{
    status: Status;
    title: string;
}>) {
    return (
        <>
            <div
                className={`${styles.statusBox} ${styles.statusBoxWalletEmbedded}`}
            >
                <InnerStatusBox status={status} title={title} />
            </div>
            {children}
        </>
    );
}

function InnerStatusBox({
    status,
    title,
}: {
    status: Status;
    title: string;
}) {
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
