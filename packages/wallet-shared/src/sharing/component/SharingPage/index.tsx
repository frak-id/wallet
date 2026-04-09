import type { SharingPageProduct } from "@frak-labs/core-sdk";
import { cx } from "class-variance-authority";
import { useState } from "react";
import { Toaster } from "sonner";
import { LogoFrakWithName } from "../../../common/icons/LogoFrakWithName";
import { Copy } from "../../icons/Copy";
import { Share } from "../../icons/Share";
import { PostShareConfirmation } from "../PostShareConfirmation";
import styles from "./index.module.css";

export type SharingPageProps = {
    /**
     * The merchant app name displayed in the header.
     */
    appName: string;
    /**
     * The merchant logo URL displayed in the header.
     */
    logoUrl?: string;
    /**
     * Products to display in the sharing page.
     */
    products: SharingPageProduct[];
    /**
     * The computed sharing link (with Frak context encoded).
     * When null, share/copy buttons are disabled.
     */
    sharingLink: string | null;
    /**
     * The install URL for the wallet app.
     * Shown on the PostShareConfirmation screen.
     */
    installUrl: string | null;
    /**
     * Translation function — each consumer provides their own.
     * Listener: cloned i18n with merchant overrides.
     * Wallet: plain useTranslation().
     */
    t: (key: string, options?: Record<string, unknown>) => string;
    /**
     * Whether a share action is currently in progress (pending navigator.share).
     */
    isSharing: boolean;
    /**
     * Whether to show the post-share confirmation screen.
     */
    showConfirmation: boolean;
    /**
     * Called when the user clicks the "Share" button.
     */
    onShare: () => void;
    /**
     * Called when the user clicks the "Copy" button.
     */
    onCopy: () => void;
    /**
     * Called when the user clicks the "Later" / dismiss button.
     */
    onDismiss: () => void;
    /**
     * Called when the user clicks "Share again" on the confirmation screen.
     */
    onShareAgain: () => void;
    /**
     * Called when the user clicks the install CTA on the confirmation screen.
     * Listener: emitLifecycleEvent (iframe→parent redirect).
     * Wallet: navigate to /install route.
     */
    onInstall: () => void;
    /**
     * Called when the user dismisses the confirmation screen.
     */
    onConfirmationDismiss: () => void;
};

export function SharingPage({
    appName,
    logoUrl,
    products,
    sharingLink,
    installUrl,
    t,
    isSharing,
    showConfirmation,
    onShare,
    onCopy,
    onDismiss,
    onShareAgain,
    onInstall,
    onConfirmationDismiss,
}: SharingPageProps) {
    if (showConfirmation) {
        return (
            <PostShareConfirmation
                installUrl={installUrl}
                appName={appName}
                logoUrl={logoUrl}
                t={t}
                onDismiss={onConfirmationDismiss}
                onShareAgain={onShareAgain}
                onInstall={onInstall}
            />
        );
    }

    return (
        <div className={styles.container}>
            <Toaster position="top-center" />

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
                    {t("sdk.sharingPage.dismiss")}
                </button>
            </header>

            <main className={styles.main}>
                <section className={styles.rewardSection}>
                    <div className={styles.rewardCard}>
                        <h2 className={styles.rewardTitle}>
                            {t("sdk.sharingPage.reward.title")}
                        </h2>
                        <p className={styles.rewardTagline}>
                            {t("sdk.sharingPage.reward.tagline")}
                        </p>
                    </div>
                </section>

                {products.length > 0 && (
                    <section className={styles.productsSection}>
                        {products.map(
                            (product: SharingPageProduct, index: number) => (
                                <div key={index} className={styles.productCard}>
                                    {product.imageUrl && (
                                        <img
                                            src={product.imageUrl}
                                            alt={product.title}
                                            className={styles.productImage}
                                        />
                                    )}
                                    <div className={styles.productInfo}>
                                        <span className={styles.productTitle}>
                                            {product.title}
                                        </span>
                                        <div className={styles.checkboxIcon}>
                                            ✓
                                        </div>
                                    </div>
                                </div>
                            )
                        )}
                    </section>
                )}

                <section className={styles.stepsSection}>
                    <h3 className={styles.sectionTitle}>
                        {t("sdk.sharingPage.steps.title")}
                    </h3>
                    <ol className={styles.stepsList}>
                        <li className={styles.stepItem}>
                            <span className={styles.stepNumber}>1</span>
                            <p>{t("sdk.sharingPage.steps.1")}</p>
                        </li>
                        <li className={styles.stepItem}>
                            <span className={styles.stepNumber}>2</span>
                            <p>{t("sdk.sharingPage.steps.2")}</p>
                        </li>
                        <li className={styles.stepItem}>
                            <span className={styles.stepNumber}>3</span>
                            <p>{t("sdk.sharingPage.steps.3")}</p>
                        </li>
                    </ol>
                </section>

                <section className={styles.faqSection}>
                    <h3 className={styles.sectionTitle}>
                        {t("sdk.sharingPage.faq.title")}
                    </h3>
                    <div className={styles.faqList}>
                        <FaqItem
                            question={t("sdk.sharingPage.faq.q1")}
                            answer={t("sdk.sharingPage.faq.a1")}
                        />
                        <FaqItem
                            question={t("sdk.sharingPage.faq.q2")}
                            answer={t("sdk.sharingPage.faq.a2")}
                        />
                        <FaqItem
                            question={t("sdk.sharingPage.faq.q3")}
                            answer={t("sdk.sharingPage.faq.a3")}
                        />
                        <FaqItem
                            question={t("sdk.sharingPage.faq.q4")}
                            answer={t("sdk.sharingPage.faq.a4")}
                        />
                        <FaqItem
                            question={t("sdk.sharingPage.faq.q5")}
                            answer={t("sdk.sharingPage.faq.a5")}
                        />
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                <button
                    type="button"
                    className={cx(styles.actionButton, styles.shareButton)}
                    onClick={onShare}
                    disabled={isSharing || !sharingLink}
                >
                    <Share />
                    <span>{t("sharing.btn.share")}</span>
                </button>
                <button
                    type="button"
                    className={cx(styles.actionButton, styles.copyButton)}
                    onClick={onCopy}
                    disabled={!sharingLink}
                >
                    <Copy />
                    <span>{t("sharing.btn.copy")}</span>
                </button>
            </footer>
        </div>
    );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={styles.faqItem}>
            <button
                type="button"
                className={styles.faqQuestion}
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
            >
                <span>{question}</span>
                <span className={styles.faqToggle}>{isOpen ? "−" : "+"}</span>
            </button>
            {isOpen && <div className={styles.faqAnswer}>{answer}</div>}
        </div>
    );
}
