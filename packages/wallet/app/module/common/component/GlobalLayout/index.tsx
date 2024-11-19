import { Header } from "@/module/common/component/Header";
import { useIsWebAuthNSupported } from "@/module/common/hook/useIsWebAuthNSupported";
import { cx } from "class-variance-authority";
import type { ReactNode } from "react";
import { Trans } from "react-i18next";
import { Navigation } from "../Navigation";
import styles from "./index.module.css";

export function GlobalLayout({
    header = true,
    navigation = false,
    children,
}: Readonly<{
    header?: boolean;
    navigation?: boolean;
    children: ReactNode;
}>) {
    /**
     * Check if webauthn is supported or not
     */
    const isWebAuthnSupported = useIsWebAuthNSupported();

    if (!isWebAuthnSupported) {
        return <WebAuthNNotSupported />;
    }

    return (
        <div className={"desktop scrollbars"}>
            {header && <Header />}
            <main
                className={cx(
                    styles.main,
                    !header && styles.mainNoHeader,
                    !navigation && styles.mainNoNav
                )}
            >
                {children}
            </main>
            {navigation && <Navigation />}
        </div>
    );
}

/**
 * Small view telling the user that webauthn is not supported on his browser
 * @constructor
 */
function WebAuthNNotSupported() {
    return (
        <div className={"desktop scrollbars"}>
            <div className={styles.wrapper}>
                <main className={styles.main}>
                    <div className={styles.inner}>
                        <Trans i18nKey="wallet.errors.webauthnNotSupported" />
                    </div>
                </main>
            </div>
        </div>
    );
}
