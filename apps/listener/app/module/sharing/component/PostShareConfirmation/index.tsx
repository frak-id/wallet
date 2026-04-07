import { clientIdStore, LogoFrakWithName } from "@frak-labs/wallet-shared";
import { useMemo } from "react";
import {
    useListenerTranslation,
    useSharingListenerUI,
} from "@/module/providers/ListenerUiProvider";
import { useSafeResolvingContext } from "@/module/stores/hooks";

import styles from "./index.module.css";

type PostShareConfirmationProps = {
    onDismiss: () => void;
};

export function PostShareConfirmation({
    onDismiss,
}: PostShareConfirmationProps) {
    const { currentRequest } = useSharingListenerUI();
    const { t } = useListenerTranslation();
    const { merchantId } = useSafeResolvingContext();
    const clientId = clientIdStore((s) => s.clientId);

    const appName = currentRequest.appName;
    const logoUrl = currentRequest.logoUrl;

    const installUrl = useMemo(() => {
        if (!(merchantId && clientId)) return null;
        const baseUrl = window.location.origin;
        return `${baseUrl}/install?m=${encodeURIComponent(merchantId)}&a=${encodeURIComponent(clientId)}`;
    }, [merchantId, clientId]);

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerLogos}>
                    <LogoFrakWithName className={styles.frakLogo} />
                    {logoUrl && (
                        <>
                            <span className={styles.logoSeparator}>+</span>
                            <img
                                src={logoUrl}
                                alt={appName}
                                className={styles.merchantLogo}
                            />
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    className={styles.dismissButton}
                >
                    ✕
                </button>
            </header>

            <main className={styles.main}>
                <section className={styles.heroSection}>
                    <h1 className={styles.title}>
                        {t("sdk.sharingPage.confirmation.title")}
                    </h1>
                    <p className={styles.subtitle}>
                        {t("sdk.sharingPage.confirmation.subtitle")}
                    </p>
                </section>

                <section className={styles.benefitsSection}>
                    <BenefitItem
                        icon="🔒"
                        title={t(
                            "sdk.sharingPage.confirmation.benefits.wallet.title"
                        )}
                        description={t(
                            "sdk.sharingPage.confirmation.benefits.wallet.description"
                        )}
                    />
                    <BenefitItem
                        icon="🔔"
                        title={t(
                            "sdk.sharingPage.confirmation.benefits.notify.title"
                        )}
                        description={t(
                            "sdk.sharingPage.confirmation.benefits.notify.description"
                        )}
                    />
                    <BenefitItem
                        icon="💸"
                        title={t(
                            "sdk.sharingPage.confirmation.benefits.cashout.title"
                        )}
                        description={t(
                            "sdk.sharingPage.confirmation.benefits.cashout.description"
                        )}
                    />
                </section>
            </main>

            <footer className={styles.footer}>
                {installUrl ? (
                    <a
                        href={installUrl}
                        target="_top"
                        className={styles.ctaButton}
                    >
                        {t("sdk.sharingPage.confirmation.cta")}
                    </a>
                ) : (
                    <button type="button" disabled className={styles.ctaButton}>
                        {t("sdk.sharingPage.confirmation.cta")}
                    </button>
                )}
            </footer>
        </div>
    );
}

function BenefitItem({
    icon,
    title,
    description,
}: {
    icon: string;
    title: string;
    description: string;
}) {
    return (
        <div className={styles.benefitItem}>
            <span className={styles.benefitIcon}>{icon}</span>
            <div className={styles.benefitContent}>
                <h3 className={styles.benefitTitle}>{title}</h3>
                <p className={styles.benefitDescription}>{description}</p>
            </div>
        </div>
    );
}
