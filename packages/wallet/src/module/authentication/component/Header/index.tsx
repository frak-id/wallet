"use client";

import { type PaywallContext, usePaywall } from "@/module/paywall/provider";
import styles from "./index.module.css";

export function HeaderAuthentication() {
    const { context } = usePaywall();

    return (
        <div>
            <header className={styles.header}>Frak Wallet - Alpha</header>
            <OptionalPaywallHeader context={context} />
        </div>
    );
}

function OptionalPaywallHeader({
    context,
}: { context: PaywallContext | null }) {
    // If we don't have any context, return nothing
    if (!context) {
        return <></>;
    }

    // Otherwise, return some context info
    return (
        <div>
            <br />
            <p>
                You will authenticate to unlock <b>{context.articleTitle}</b> on{" "}
                <b>{context.contentTitle}</b>
            </p>
        </div>
    );
}
