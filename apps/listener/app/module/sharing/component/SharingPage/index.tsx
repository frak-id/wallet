import {
    FrakContextManager,
    type SharingPageProduct,
} from "@frak-labs/core-sdk";
import {
    clientIdStore,
    LogoFrakWithName,
    trackGenericEvent,
    useCopyToClipboardWithState,
} from "@frak-labs/wallet-shared";
import { cx } from "class-variance-authority";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Toaster, toast } from "sonner";
import { Copy } from "@/module/common/icons/Copy";
import { Share } from "@/module/common/icons/Share";
import { useShareLink } from "@/module/hooks/useShareLink";
import { useTrackSharing } from "@/module/hooks/useTrackSharing";
import {
    useListenerTranslation,
    useSharingListenerUI,
} from "@/module/providers/ListenerUiProvider";
import { PostShareConfirmation } from "@/module/sharing/component/PostShareConfirmation";
import { useSafeResolvingContext } from "@/module/stores/hooks";

import styles from "./index.module.css";

const SHARING_CONFIRMED_KEY = "frak_sharing_confirmed";
const CONFIRMATION_TTL_MS = 60 * 60 * 1000; // 1 hour

function getSavedConfirmation(merchantId: string): boolean {
    try {
        const raw = sessionStorage.getItem(SHARING_CONFIRMED_KEY);
        if (!raw) return false;
        const saved = JSON.parse(raw) as {
            merchantId: string;
            timestamp: number;
        };
        return (
            saved.merchantId === merchantId &&
            Date.now() - saved.timestamp < CONFIRMATION_TTL_MS
        );
    } catch {
        return false;
    }
}

function saveConfirmation(merchantId: string) {
    try {
        sessionStorage.setItem(
            SHARING_CONFIRMED_KEY,
            JSON.stringify({ merchantId, timestamp: Date.now() })
        );
    } catch {
        // sessionStorage may not be available in some iframe contexts
    }
}

export function ListenerSharingPage() {
    const { currentRequest, clearRequest } = useSharingListenerUI();
    const { t } = useListenerTranslation();
    const { sourceUrl, merchantId } = useSafeResolvingContext();
    const clientId = clientIdStore((s) => s.clientId);
    const { copy } = useCopyToClipboardWithState();
    const { mutate: trackSharing } = useTrackSharing();

    const hasResolvedRef = useRef(false);

    // Compute the install URL centrally
    const installUrl = useMemo(() => {
        if (!(merchantId && clientId)) return null;
        const baseUrl = window.location.origin;
        return `${baseUrl}/install?m=${encodeURIComponent(merchantId)}&a=${encodeURIComponent(clientId)}`;
    }, [merchantId, clientId]);

    // Check sessionStorage for a recent confirmation (Approach 1)
    const [showConfirmation, setShowConfirmation] = useState(() =>
        merchantId ? getSavedConfirmation(merchantId) : false
    );

    // If we restore from sessionStorage, still resolve the RPC as "shared"
    // so the SDK consumer gets the result
    useEffect(() => {
        if (showConfirmation && !hasResolvedRef.current) {
            hasResolvedRef.current = true;
            currentRequest.emitter({
                result: {
                    action: "shared",
                    installUrl: installUrl ?? undefined,
                },
            });
        }
    }, [showConfirmation, currentRequest.emitter, installUrl]);

    const resolveAction = useCallback(
        (action: "shared" | "copied" | "dismissed") => {
            if (hasResolvedRef.current) return;
            hasResolvedRef.current = true;
            currentRequest.emitter({
                result: { action, installUrl: installUrl ?? undefined },
            });
        },
        [currentRequest.emitter, installUrl]
    );

    const handleDismiss = () => {
        resolveAction("dismissed");
        clearRequest();
    };

    const handleShareAgain = () => {
        try {
            sessionStorage.removeItem(SHARING_CONFIRMED_KEY);
        } catch {
            // sessionStorage may not be available in some iframe contexts
        }
        hasResolvedRef.current = false;
        setShowConfirmation(false);
    };

    const finalSharingLink = useMemo(() => {
        if (!(clientId && merchantId)) return null;
        return FrakContextManager.update({
            url: currentRequest.params.link ?? sourceUrl,
            context: {
                v: 2,
                c: clientId,
                m: merchantId,
                t: Math.floor(Date.now() / 1000),
            },
        });
    }, [clientId, merchantId, currentRequest.params.link, sourceUrl]);

    const { mutate: triggerSharing, isPending: isSharing } = useShareLink(
        finalSharingLink,
        {
            onSuccess: (message) => {
                if (message) toast.success(message as string);
                resolveAction("shared");
                if (merchantId) saveConfirmation(merchantId);
                setShowConfirmation(true);
            },
        }
    );

    const handleCopy = () => {
        if (!finalSharingLink) return;
        copy(finalSharingLink);
        trackGenericEvent("sharing-copy-link", {
            link: finalSharingLink,
        });
        trackSharing();
        toast.success(t("sharing.btn.copySuccess"));
        resolveAction("copied");
        if (merchantId) saveConfirmation(merchantId);
        setShowConfirmation(true);
    };

    const handleShare = () => {
        if (!finalSharingLink) return;
        triggerSharing();
        trackGenericEvent("sharing-share-link", {
            link: finalSharingLink,
        });
    };

    const products = currentRequest.params.products ?? [];
    const appName = currentRequest.appName;
    const logoUrl = currentRequest.logoUrl;

    if (showConfirmation) {
        return (
            <PostShareConfirmation
                installUrl={installUrl}
                onDismiss={clearRequest}
                onShareAgain={handleShareAgain}
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
                    onClick={handleDismiss}
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
                    onClick={handleShare}
                    disabled={isSharing || !finalSharingLink}
                >
                    <Share />
                    <span>{t("sharing.btn.share")}</span>
                </button>
                <button
                    type="button"
                    className={cx(styles.actionButton, styles.copyButton)}
                    onClick={handleCopy}
                    disabled={!finalSharingLink}
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
