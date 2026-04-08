import { LogoFrakWithName } from "@frak-labs/wallet-shared";
import {
    useListenerTranslation,
    useSharingListenerUI,
} from "@/module/providers/ListenerUiProvider";

import styles from "./index.module.css";

type PostShareConfirmationProps = {
    installUrl: string | null;
    onDismiss: () => void;
    onShareAgain: () => void;
};

export function PostShareConfirmation({
    installUrl,
    onDismiss,
    onShareAgain,
}: PostShareConfirmationProps) {
    const { currentRequest } = useSharingListenerUI();
    const { t } = useListenerTranslation();

    const appName = currentRequest.appName;
    const logoUrl = currentRequest.logoUrl;
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
                <button
                    type="button"
                    className={styles.shareAgainButton}
                    onClick={onShareAgain}
                >
                    {t("sdk.sharingPage.confirmation.shareAgain")}
                </button>
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
